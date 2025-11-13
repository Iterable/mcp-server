import { IterableClient } from "@iterable/api";
import { beforeEach, describe, expect, it } from "@jest/globals";

import { generatePromptMessage, generatePrompts } from "../../src/prompts.js";
import { filterTools } from "../../src/tool-filter.js";
import { createAllTools } from "../../src/tools/index.js";

describe("MCP Prompts", () => {
  let client: IterableClient;

  // Create a real client with mocked HTTP layer
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    client = new IterableClient(
      {
        apiKey: "test-key",
        baseUrl: "https://api.iterable.com",
        timeout: 30000,
      },
      mockAxiosInstance as any
    );
  });

  describe("generatePrompts", () => {
    it("should generate prompts from tools", () => {
      const tools = createAllTools(client);
      const prompts = generatePrompts(tools);

      expect(Array.isArray(prompts)).toBe(true);
      expect(prompts.length).toBeGreaterThan(0);

      // Check that each prompt has required properties
      prompts.forEach((prompt) => {
        expect(prompt).toHaveProperty("name");
        expect(prompt).toHaveProperty("description");
        expect(prompt).toHaveProperty("arguments");
        expect(Array.isArray(prompt.arguments)).toBe(true);

        // Prompt names should be kebab-case
        expect(prompt.name).toMatch(/^[a-z-]+$/);
        expect(prompt.name).not.toContain("_");
      });
    });

    it("should include expected common prompts", () => {
      const tools = createAllTools(client);
      const prompts = generatePrompts(tools);
      const promptNames = prompts.map((p) => p.name);

      // Check for some key prompts we expect (all tools since no filtering in generatePrompts)
      expect(promptNames).toContain("get-user-by-email");
      expect(promptNames).toContain("get-user-by-user-id");
      expect(promptNames).toContain("get-campaigns");
      expect(promptNames).toContain("get-experiment-metrics");
      expect(promptNames).toContain("create-campaign"); // Now included since we pass all tools
      expect(promptNames).toContain("get-child-campaigns");
    });

    it("should convert tool names to prompt names correctly", () => {
      const tools = createAllTools(client);
      const prompts = generatePrompts(tools);
      const promptNames = prompts.map((p) => p.name);

      // Verify underscore to dash conversion
      expect(promptNames).toContain("get-user-by-email"); // from get_user_by_email
      expect(promptNames).toContain("get-experiment-metrics"); // from get_experiment_metrics

      // Should not contain underscores
      promptNames.forEach((name) => {
        expect(name).not.toContain("_");
      });
    });

    it("should generate valid prompt arguments from tool schemas", () => {
      const tools = createAllTools(client);
      const prompts = generatePrompts(tools);

      const getUserPrompt = prompts.find((p) => p.name === "get-user-by-email");
      expect(getUserPrompt).toBeDefined();
      if (!getUserPrompt || !getUserPrompt.arguments) return;

      expect(getUserPrompt.arguments).toHaveLength(1);
      expect(getUserPrompt.arguments[0]).toEqual({
        name: "email",
        description: "Email address of the user to retrieve",
        required: true,
      });

      const getExperimentMetricsPrompt = prompts.find(
        (p) => p.name === "get-experiment-metrics"
      );
      expect(getExperimentMetricsPrompt).toBeDefined();
      if (!getExperimentMetricsPrompt || !getExperimentMetricsPrompt.arguments)
        return;

      expect(getExperimentMetricsPrompt.arguments.length).toBeGreaterThan(0);

      const experimentIdArg = getExperimentMetricsPrompt.arguments.find(
        (arg) => arg.name === "experimentId"
      );
      expect(experimentIdArg).toBeDefined();
      if (!experimentIdArg) return;

      expect(experimentIdArg.required).toBe(false); // Optional parameter
    });

    it("should work with filtered read-only tools", () => {
      // Test the pattern used in the server: filter to read-only tools first
      const allTools = createAllTools(client);
      const readOnlyConfig = {
        allowUserPii: true,
        allowWrites: false,
        allowSends: false,
      };
      const readOnlyTools = filterTools(allTools, readOnlyConfig);
      const prompts = generatePrompts(readOnlyTools);

      const promptNames = prompts.map((p) => p.name);

      // Should include read-only tools
      expect(promptNames).toContain("get-user-by-email");
      expect(promptNames).toContain("get-campaigns");

      // Should NOT include write or send tools
      expect(promptNames).not.toContain("create-campaign");
      expect(promptNames).not.toContain("update-user");
      expect(promptNames).not.toContain("send-email");
      expect(promptNames).not.toContain("send-email-template-proof");
    });
  });

  describe("generatePromptMessage", () => {
    it("should generate message for prompt without arguments", () => {
      const result = generatePromptMessage("get-campaigns");

      expect(result).toHaveProperty("messages");
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages).toHaveLength(1);

      const message = result.messages[0];
      expect(message).toHaveProperty("role", "user");
      expect(message).toHaveProperty("content");
      if (!message) return;

      expect(message.content).toHaveProperty("type", "text");
      expect(message.content).toHaveProperty("text");
      expect(message.content.text).toContain("get_campaigns tool");
    });

    it("should generate message for prompt with arguments", () => {
      const args = { email: "test@example.com", eventName: "test_event" };
      const result = generatePromptMessage("track-event", args);

      expect(result).toHaveProperty("messages");
      const message = result.messages[0];
      if (!message) return;

      expect(message.content.text).toContain(
        "track_event tool with parameters"
      );
      expect(message.content.text).toContain('"email": "test@example.com"');
      expect(message.content.text).toContain('"eventName": "test_event"');
    });

    it("should convert prompt names back to tool names", () => {
      const result = generatePromptMessage("get-user-by-email", {
        email: "test@example.com",
      });

      const message = result.messages[0];
      if (!message) return;

      expect(message.content.text).toContain("get_user_by_email tool"); // converted back from get-user-by-email
    });

    it("should handle export prompt name conversion", () => {
      const result = generatePromptMessage("export-data", {
        dataTypeName: "user",
        startDateTime: "2024-01-01",
        endDateTime: "2024-01-31",
      });
      const message = result.messages[0];
      if (!message) return;
      expect(message.content.text).toContain("export_data tool");
    });

    it("should filter out undefined and empty string arguments", () => {
      const args = {
        email: "test@example.com",
        optional: undefined,
        empty: "",
        valid: "value",
      };
      const result = generatePromptMessage("get-user-by-email", args);

      const message = result.messages[0];
      if (!message) return; // Type guard

      expect(message.content.text).toContain('"email": "test@example.com"');
      expect(message.content.text).toContain('"valid": "value"');
      expect(message.content.text).not.toContain("optional");
      expect(message.content.text).not.toContain("empty");
    });

    it("should handle different argument types correctly", () => {
      const args = {
        stringArg: "test",
        numberArg: 42,
        booleanArg: true,
        objectArg: { nested: "value" },
      };
      const result = generatePromptMessage("test-tool", args);

      const message = result.messages[0];
      if (!message) return; // Type guard

      expect(message.content.text).toContain('"stringArg": "test"');
      expect(message.content.text).toContain('"numberArg": 42');
      expect(message.content.text).toContain('"booleanArg": true');
      expect(message.content.text).toContain('"objectArg": {"nested":"value"}');
    });
  });
});
