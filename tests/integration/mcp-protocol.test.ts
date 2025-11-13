import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { ChildProcess, spawn } from "child_process";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// API key resolution: prefer env; on macOS fall back to Keychain active key.
const isValidApiKey = (key: string | undefined): boolean =>
  typeof key === "string" && /^[a-f0-9]{32}$/.test(key);
let resolvedApiKey: string | undefined = process.env.ITERABLE_API_KEY;
let resolvedBaseUrl: string =
  process.env.ITERABLE_BASE_URL || "https://api.iterable.com";

// Test helper functions (simplified for MCP server)
const uniqueId = () => Math.random().toString(36).substring(2, 15);
const createTestIdentifiers = () => ({
  email: `test-${uniqueId()}@example.com`,
  userId: uniqueId(),
});
const waitForUserUpdate = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
const withTimeout = async <T>(promise: Promise<T>, ms = 5000): Promise<T> => {
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Timeout")), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    // Always clear the timeout to prevent handles from staying open
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const packageJson = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../package.json"),
    "utf-8"
  )
);

describe("MCP Protocol Integration Tests", () => {
  let serverProcess: ChildProcess;
  let serverStartupMessage: string = "";
  const { email: testUserEmail } = createTestIdentifiers();

  beforeAll(async () => {
    // Resolve API key: env or macOS Keychain active key
    if (!isValidApiKey(resolvedApiKey) && process.platform === "darwin") {
      try {
        const { getKeyManager } = await import("../../src/key-manager.js");
        const km = getKeyManager();
        await km.initialize();
        const activeKey = await km.getActiveKey();
        const meta = await km.getActiveKeyMetadata();
        if (activeKey && isValidApiKey(activeKey)) {
          resolvedApiKey = activeKey;
          if (meta?.baseUrl) {
            resolvedBaseUrl = meta.baseUrl;
          }
        }
      } catch {
        // ignore; will error if still invalid
      }
    }

    if (!isValidApiKey(resolvedApiKey)) {
      throw new Error(
        "No valid API key found. Set ITERABLE_API_KEY or add/activate a key in macOS Keychain."
      );
    }

    // Start MCP server once for this suite
    serverProcess = spawn("node", ["dist/index.js"], {
      env: {
        ...process.env,
        ITERABLE_API_KEY: resolvedApiKey as string,
        ITERABLE_BASE_URL: resolvedBaseUrl,
        ITERABLE_USER_PII: "true",
        ITERABLE_ENABLE_WRITES: "true",
        ITERABLE_ENABLE_SENDS: "true",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Wait for server to report ready
    await new Promise<void>((resolve, reject) => {
      const onData = (data: Buffer) => {
        const output = data.toString();
        if (output.includes("Iterable MCP server")) {
          serverStartupMessage = output;
          serverProcess?.stderr?.off("data", onData);
          serverProcess?.stderr?.off("data", onError);
          clearTimeout(timeout);
          resolve();
        }
      };
      const onError = (data: Buffer) => {
        const output = data.toString();
        if (output.includes("Failed to start server")) {
          serverProcess?.stderr?.off("data", onData);
          serverProcess?.stderr?.off("data", onError);
          clearTimeout(timeout);
          reject(new Error(output));
        }
      };
      const timeout = setTimeout(() => {
        serverProcess?.stderr?.off("data", onData);
        serverProcess?.stderr?.off("data", onError);
        reject(new Error("Server startup timeout"));
      }, 15000);
      serverProcess.stderr?.on("data", onData);
      serverProcess.stderr?.on("data", onError);
    });

    // Perform MCP initialize handshake once
    const initRequest = {
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {}, prompts: {} },
        clientInfo: { name: "jest", version: "1.0.0" },
      },
    };
    const initResponse = await withTimeout(sendMcpRequest(initRequest));
    expect(initResponse).toHaveProperty("result");
  });

  afterAll(async () => {
    if (serverProcess) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          try {
            // Final fallback
            serverProcess.kill("SIGKILL");
          } catch {
            // Ignore errors
          }
          resolve();
        }, 5000);
        serverProcess.once("close", () => {
          clearTimeout(timer);
          resolve();
        });
        // Proactively close stdio and remove listeners before signals
        try {
          serverProcess.stdin?.end();
        } catch (_e) {
          void 0;
        }
        try {
          serverProcess.stdout?.removeAllListeners();
          serverProcess.stderr?.removeAllListeners();
        } catch (_e) {
          void 0;
        }
        try {
          serverProcess.stdout?.destroy();
          serverProcess.stderr?.destroy();
        } catch (_e) {
          void 0;
        }
        try {
          serverProcess.kill("SIGINT");
        } catch {
          serverProcess.kill();
        }
      });
    }
    try {
      await callTool(
        "delete_user_by_email",
        { email: testUserEmail },
        undefined,
        15000
      );
    } catch (_e) {
      void 0;
    }
  });

  // Helper function to send JSON-RPC messages to the server
  async function sendMcpRequest(request: any): Promise<any> {
    if (!serverProcess?.stdin || !serverProcess?.stdout) {
      throw new Error("Server process not available");
    }

    const { stdin, stdout } = serverProcess;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("MCP request timeout"));
      }, 20000);

      let buffer = "";

      const onData = (data: Buffer) => {
        buffer += data.toString("utf8");

        // Process complete lines from buffer
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line) continue;

          try {
            const response = JSON.parse(line);
            if (response.id === request.id) {
              cleanup();
              resolve(response);
              return;
            }
          } catch {
            // Ignore malformed JSON
          }
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        stdout.off("data", onData);
      };

      stdout.setMaxListeners(0);
      stdout.on("data", onData);

      const json = JSON.stringify(request) + "\n";
      stdin.write(json);
    });
  }

  // JSON-RPC helper utilities to reduce redundancy in tests
  let _jsonRpcId = 0;
  function nextId(): number {
    return ++_jsonRpcId;
  }

  async function callWith(
    method: string,
    params: Record<string, unknown> = {},
    id?: number,
    timeoutMs = 15000
  ) {
    const request = {
      jsonrpc: "2.0",
      id: id ?? nextId(),
      method,
      params,
    } as const;
    return withTimeout(sendMcpRequest(request), timeoutMs);
  }

  async function listTools(timeoutMs = 15000) {
    return callWith("tools/list", {}, undefined, timeoutMs);
  }

  async function callTool(
    name: string,
    args: Record<string, unknown> = {},
    id?: number,
    timeoutMs = 15000
  ) {
    return callWith(
      "tools/call",
      {
        name,
        arguments: args,
      },
      id,
      timeoutMs
    );
  }

  async function callPrompt(
    nameOrMethod: "prompts/list" | string,
    args: Record<string, unknown> = {},
    id?: number,
    timeoutMs = 15000
  ) {
    if (nameOrMethod === "prompts/list") {
      return callWith("prompts/list", {}, id, timeoutMs);
    }
    return callWith(
      "prompts/get",
      {
        name: nameOrMethod,
        arguments: args,
      },
      id,
      timeoutMs
    );
  }

  function expectOk(response: any, expectedId?: number) {
    expect(response).toHaveProperty("jsonrpc", "2.0");
    if (expectedId !== undefined)
      expect(response).toHaveProperty("id", expectedId);
    expect(response).toHaveProperty("result");
  }

  function expectError(response: any, expectedId?: number) {
    expect(response).toHaveProperty("jsonrpc", "2.0");
    if (expectedId !== undefined)
      expect(response).toHaveProperty("id", expectedId);
    expect(response).toHaveProperty("error");
  }

  function getText(response: any): string {
    return response?.result?.content?.[0]?.text ?? "";
  }

  function getJson<T = any>(response: any): T {
    return JSON.parse(getText(response));
  }

  describe("Server Lifecycle", () => {
    it("should start server successfully", async () => {
      expect(serverProcess && serverProcess.pid).toBeDefined();
    });

    it("should include correct version in startup message", async () => {
      const expectedMessage = `Iterable MCP server v${packageJson.version} running on stdio`;
      expect(serverStartupMessage).toContain(expectedMessage);
    });
  });

  describe("MCP Protocol", () => {
    it("should respond to list tools request", async () => {
      const response = await listTools();
      expectOk(response);
      const toolNames = response.result.tools.map((tool: any) => tool.name);
      expect(toolNames).toEqual(
        expect.arrayContaining([
          "get_user_by_email",
          "get_user_by_user_id",
          "update_user",
          "update_email",
          "update_user_subscriptions",
          "delete_user_by_email",
          "delete_user_by_user_id",
          "track_event",
          "send_email",
          "get_campaigns",
          "send_whatsapp",
          "send_sms",
          "get_in_app_messages",
          "create_list",
          "get_webhooks",
        ])
      );
    });

    it("should validate tool schemas", async () => {
      const listResponse = await listTools();
      const tools = listResponse.result.tools;

      // Verify each tool has required schema properties
      tools.forEach((tool: any) => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(tool.inputSchema).toHaveProperty("type", "object");
        expect(tool.inputSchema).toHaveProperty("properties");

        if (tool.inputSchema.required) {
          expect(Array.isArray(tool.inputSchema.required)).toBe(true);
        }
      });

      // Test specific tool schemas
      const getUserTool = tools.find(
        (t: any) => t.name === "get_user_by_email"
      );
      expect(getUserTool).toBeDefined();
      expect(getUserTool.inputSchema.properties).toHaveProperty("email");
      expect(getUserTool.inputSchema.required).toContain("email");

      const trackEventTool = tools.find((t: any) => t.name === "track_event");
      expect(trackEventTool).toBeDefined();
      expect(trackEventTool.inputSchema.properties).toHaveProperty("eventName");
      expect(trackEventTool.inputSchema.required).toContain("eventName");
    });

    it("should execute get_user tool successfully", async () => {
      const testEmail = `mcptest+${uniqueId()}@example.com`;
      // Create/update the user via MCP tool
      await callTool("update_user", {
        email: testEmail,
        dataFields: { mcpTest: true },
      });
      // Ensure eventual consistency before calling MCP tool
      await waitForUserUpdate(1000);

      try {
        const response = await callTool(
          "get_user_by_email",
          { email: testEmail },
          3
        );
        expectOk(response, 3);
        const userData = getJson(response);
        expect(userData).toHaveProperty("user");
        expect(userData.user.email).toBe(testEmail);
        expect(userData.user.dataFields?.mcpTest).toBe(true);
      } finally {
        try {
          await callTool(
            "delete_user_by_email",
            { email: testEmail },
            undefined,
            15000
          );
        } catch (_e) {
          void 0;
        }
      }
    });

    it("should execute track_event tool successfully", async () => {
      const testEmail = `mcptest+${uniqueId()}@example.com`;

      await callTool("update_user", {
        email: testEmail,
        dataFields: { mcpEventTest: true },
      });

      try {
        const response = await callTool(
          "track_event",
          {
            email: testEmail,
            eventName: "mcp_integration_test",
            dataFields: {
              testProperty: "mcp-test-value",
            },
          },
          4
        );
        expectOk(response, 4);
        const responseData = getJson(response);
        expect(responseData).toHaveProperty("msg");
        expect(responseData).toHaveProperty("code");
      } finally {
        try {
          await callTool(
            "delete_user_by_email",
            { email: testEmail },
            undefined,
            15000
          );
        } catch (_e) {
          void 0;
        }
      }
    });

    it("should handle ISO date format transformation for start_export_job", async () => {
      const response = await callTool(
        "start_export_job",
        {
          dataTypeName: "user",
          outputFormat: "text/csv",
          startDateTime: "2024-12-01T00:00:00Z",
          endDateTime: "2024-12-01T23:59:59Z",
        },
        302
      );
      expectOk(response, 302);

      const result = getJson(response);
      expect(result).toHaveProperty("jobId");

      // Clean up
      await callTool("cancel_export_job", { jobId: result.jobId }, 303);
    });

    it("should execute get_campaigns tool successfully", async () => {
      const response = await callTool("get_campaigns", { limit: 5 }, 5);
      expectOk(response, 5);
      const responseData = getJson(response);
      expect(responseData).toHaveProperty("campaigns");
      expect(Array.isArray(responseData.campaigns)).toBe(true);
    });

    it("should execute get_available_export_data_types tool successfully", async () => {
      const response = await callTool("get_available_export_data_types", {});
      expectOk(response);
      const dataTypes = getJson(response);

      expect(Array.isArray(dataTypes)).toBe(true);
      expect(dataTypes).toContain("user");
      expect(dataTypes).toContain("emailSend");
      expect(dataTypes).toContain("pushSend");
      expect(dataTypes.length).toBeGreaterThan(40);

      dataTypes.forEach((dataType: any) => {
        expect(typeof dataType).toBe("string");
      });
    });

    it("should execute get_campaign tool successfully", async () => {
      // First get campaigns to find a valid campaign ID
      const campaignsResponse = await callTool("get_campaigns", {});
      expectOk(campaignsResponse);
      const campaignsData = getJson(campaignsResponse);

      if (campaignsData.campaigns.length > 0) {
        const campaignId = campaignsData.campaigns[0].id;

        // Test get_campaign with the valid ID
        const response = await callTool("get_campaign", { id: campaignId });
        expectOk(response);
        const data = getJson(response);

        // Verify response structure matches CampaignDetails schema
        expect(data).toHaveProperty("id", campaignId);
        expect(data).toHaveProperty("name");
        expect(data).toHaveProperty("type");
        expect(data).toHaveProperty("campaignState");
        expect(data).toHaveProperty("messageMedium");
        expect(data).toHaveProperty("createdAt");
        expect(data).toHaveProperty("updatedAt");
        expect(data).toHaveProperty("createdByUserId");

        // Verify enum values
        expect(["Blast", "Triggered"]).toContain(data.type);
        expect([
          "Draft",
          "Ready",
          "Scheduled",
          "Running",
          "Finished",
          "Starting",
          "Aborted",
          "Recurring",
          "Archived",
        ]).toContain(data.campaignState);
      }
    });

    it("should handle tool validation errors", async () => {
      const response = await callTool(
        "get_user_by_email",
        { email: "invalid-email-format" },
        6
      );
      expectError(response, 6);
      expect(response.error).toHaveProperty("code");
      expect(response.error).toHaveProperty("message");
    });

    it("should handle unknown tool error", async () => {
      const response = await callTool("unknown_tool", {}, 7);
      expectError(response, 7);
      expect(response.error.message).toContain("Unknown tool");
    });

    it("should handle missing required parameters", async () => {
      const response = await callTool(
        "track_event",
        { email: "test@example.com" },
        8
      );
      expectError(response, 8);
    });

    it("should handle Iterable API errors with structured information", async () => {
      // Test 1: Invalid list ID (400 error with "Success" code)
      const invalidListResponse = await callTool(
        "subscribe_to_list",
        {
          listId: 999999999,
          subscribers: [{ email: "test@example.com" }],
        },
        9
      );
      expectOk(invalidListResponse, 9);

      // Should get structured error information in the response content
      const errorData = getJson(invalidListResponse);
      expect(errorData).toHaveProperty("statusCode", 400);
      expect(errorData).toHaveProperty("name", "IterableApiError");
      expect(errorData.apiResponse.msg).toContain("invalidListId");
      expect(errorData.apiResponse.msg).toContain("999999999");
    });

    it("should handle Iterable validation errors", async () => {
      // Test invalid email format
      const invalidEmailResponse = await callTool(
        "get_user_by_email",
        { email: "not-an-email" },
        10
      );
      expectError(invalidEmailResponse, 10);

      // Should get validation error for invalid email
      expect(invalidEmailResponse.error.message.toLowerCase()).toContain(
        "validation"
      );
      expect(invalidEmailResponse.error.message.toLowerCase()).toContain(
        "email"
      );
    });

    it("should maintain request/response correlation", async () => {
      // Send multiple concurrent requests with different IDs
      const requests = [
        {
          jsonrpc: "2.0",
          id: 101,
          method: "tools/call",
          params: { name: "get_campaigns", arguments: { limit: 1 } },
        },
        {
          jsonrpc: "2.0",
          id: 102,
          method: "tools/call",
          params: { name: "get_lists", arguments: {} },
        },
        {
          jsonrpc: "2.0",
          id: 103,
          method: "tools/call",
          params: { name: "get_templates", arguments: { limit: 1 } },
        },
      ];

      const responses = await Promise.all(
        requests.map((request) => withTimeout(sendMcpRequest(request)))
      );

      // Verify each response has the correct ID (responses may come back out of order)
      requests.forEach((request) => {
        const matchingResponse = responses.find((r) => r.id === request.id);
        expect(matchingResponse).toBeDefined();
        expect(matchingResponse).toHaveProperty("jsonrpc", "2.0");
      });
    });
  });

  describe("MCP Prompts", () => {
    it("should respond to list prompts request", async () => {
      const response = await callPrompt("prompts/list", {}, 401, 15000);
      expectOk(response, 401);
      expect(response.result).toHaveProperty("prompts");
      expect(Array.isArray(response.result.prompts)).toBe(true);

      // Should have some prompts
      expect(response.result.prompts.length).toBeGreaterThan(0);

      // Each prompt should have required properties
      response.result.prompts.forEach((prompt: any) => {
        expect(prompt).toHaveProperty("name");
        expect(prompt).toHaveProperty("description");
        expect(prompt).toHaveProperty("arguments");
        expect(Array.isArray(prompt.arguments)).toBe(true);

        // Prompt names should be kebab-case
        expect(prompt.name).toMatch(/^[a-z-]+$/);
      });

      // Should include expected prompts
      const promptNames = response.result.prompts.map((p: any) => p.name);
      expect(promptNames).toContain("get-user-by-email");
    });

    it("should respond to get prompt request", async () => {
      const response = await callPrompt(
        "get-user-by-email",
        { email: "test@example.com" },
        402,
        15000
      );
      expectOk(response, 402);
      expect(response.result).toHaveProperty("messages");
      expect(Array.isArray(response.result.messages)).toBe(true);
      expect(response.result.messages.length).toBe(1);

      const message = response.result.messages[0];
      expect(message).toHaveProperty("role", "user");
      expect(message).toHaveProperty("content");
      expect(message.content).toHaveProperty("type", "text");
      expect(message.content).toHaveProperty("text");
      expect(message.content.text).toContain("get_user_by_email tool");
      expect(message.content.text).toContain("test@example.com");
    });

    it("should handle get prompt request without arguments", async () => {
      const response = await callPrompt("get-campaigns", {}, 403, 15000);
      expectOk(response, 403);

      const message = response.result.messages[0];
      expect(message.content.text).toContain("get_campaigns tool");
      expect(message.content.text).not.toContain("parameters");
    });

    it("should handle unknown prompt error", async () => {
      const response = await callPrompt("unknown-prompt", {}, 404, 15000);
      expectError(response, 404);
      expect(response.error).toHaveProperty("code");
      expect(response.error).toHaveProperty("message");
    });
  });

  describe("Concurrency", () => {
    it("should handle many concurrent requests", async () => {
      // Use lightweight, server-local endpoints to avoid large upstream payloads
      const requests = Array.from({ length: 20 }, (_, i) => ({
        jsonrpc: "2.0",
        id: 200 + i,
        method: i % 2 === 0 ? "tools/list" : "prompts/list",
        params: {},
      }));

      const responses = await Promise.all(
        requests.map((request) => withTimeout(sendMcpRequest(request)))
      );

      // All requests should complete successfully (responses may come back out of order)
      const expectedIds = requests.map((r) => r.id);
      expectedIds.forEach((expectedId) => {
        const matchingResponse = responses.find((r) => r.id === expectedId);
        expect(matchingResponse).toBeDefined();
        expect(matchingResponse).toHaveProperty("jsonrpc", "2.0");
      });
    });
  });
});
