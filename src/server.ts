import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { IterableClient } from "@iterable/api";
import { logger } from "@iterable/api";
import { DEFAULT_USER_AGENT } from "@iterable/api";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
  McpError,
  Prompt,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { detectClientName } from "./client-detection.js";
import { loadMcpServerConfig } from "./config.js";
import {
  HEADER_CLIENT,
  HEADER_SESSION_ID,
  HEADER_TOOL,
  HEADER_USER_AGENT,
} from "./http-headers.js";
import { generatePromptMessage, generatePrompts } from "./prompts.js";
import { setupGracefulShutdown } from "./shutdown.js";
import { filterTools } from "./tool-filter.js";
import { createAllTools } from "./tools/index.js";
import { sanitizeUrlForLogs } from "./utils/url.js";

// Session-specific context for tracking client info and session data
interface SessionContext {
  sessionId: string;
  clientName: string;
  toolName: string;
}

// Get package version
const packageJson = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
    "utf-8"
  )
);

export class IterableMcpServer {
  private server: Server;
  private iterableClient!: IterableClient;
  private tools!: Tool[];
  private prompts!: Prompt[];

  // Since we are using the stdio transport, we assume a global session
  private globalSessionId: string = createSessionId();
  private sessionContext = new AsyncLocalStorage<SessionContext>();

  constructor() {
    this.server = new Server(
      {
        name: "iterable-mcp",
        version: packageJson.version,
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();

    // Set up callback to log when MCP handshake completes
    this.server.oninitialized = () => {
      logger.info("MCP session initialized", {
        sessionId: this.globalSessionId,
        clientName: detectClientName(this.server),
      });
    };

    this.server.onerror = (error) => logger.error("MCP Error", { error });

    // Setup graceful shutdown
    setupGracefulShutdown(async () => {
      await this.server.close();
    });
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.tools,
    }));

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: this.prompts,
    }));

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!this.prompts.some((prompt) => prompt.name === name)) {
        throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
      }

      return generatePromptMessage(name, args || {});
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const tool = this.tools.find((tool) => tool.name === name);
      if (!tool || typeof tool.handler !== "function") {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      try {
        return await this.sessionContext.run(
          {
            sessionId: this.globalSessionId,
            clientName: detectClientName(this.server),
            toolName: name,
          },
          async () => {
            return await (tool.handler as any)(args || {});
          }
        );
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private setupHttpInterceptors(): void {
    // Request interceptor for adding session headers
    this.iterableClient.client.interceptors.request.use((config: any) => {
      const sessionContext = this.sessionContext.getStore();
      const userAgent = [
        `iterable-mcp/${packageJson.version}`,
        DEFAULT_USER_AGENT,
        `(node=${process.versions.node}; os=${process.platform}; client=${sessionContext?.clientName || "none"})`,
      ].join(" ");

      Object.assign(config.headers, {
        [HEADER_CLIENT]: sessionContext?.clientName,
        [HEADER_SESSION_ID]: sessionContext?.sessionId,
        [HEADER_TOOL]: sessionContext?.toolName,
        [HEADER_USER_AGENT]: userAgent,
      });

      try {
        const method = String(config.method || "GET").toUpperCase();
        const baseURL =
          config.baseURL || this.iterableClient.client.defaults.baseURL;
        const url = config.url || "";
        const fullUrl = `${baseURL || ""}${url}`;
        const safeUrl = sanitizeUrlForLogs(fullUrl);
        // SECURITY: Do not log headers or params; sanitize URL to avoid PII
        logger.debug("MCP HTTP request", {
          method,
          url: safeUrl,
          timeout: config.timeout,
        });
      } catch {
        // Ignore logging errors
      }
      return config;
    });

    // Response interceptor for error logging
    this.iterableClient.client.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        try {
          const cfg = error?.config || {};
          const method = String(cfg.method || "GET").toUpperCase();
          const baseURL =
            cfg.baseURL || this.iterableClient.client.defaults.baseURL;
          const url = cfg.url || "";
          const fullUrl = `${baseURL || ""}${url}`;
          const safeUrl = sanitizeUrlForLogs(fullUrl);
          logger.error("MCP HTTP error", {
            method,
            url: safeUrl,
            message: String(error?.message || "Unknown error"),
          });
        } catch {
          // Ignore logging errors
        }
        return Promise.reject(error);
      }
    );
  }

  async run(): Promise<void> {
    const mcpConfig = await loadMcpServerConfig();

    // Initialize Iterable client with API key and base URL from config
    this.iterableClient = new IterableClient({
      apiKey: mcpConfig.apiKey,
      baseUrl: mcpConfig.baseUrl,
    });
    this.setupHttpInterceptors();

    // Create tools with filtering based on configuration
    const allTools = createAllTools(this.iterableClient);
    this.tools = filterTools(allTools, mcpConfig);

    // Create prompts from read-only tools only (for safety)
    const readOnlyTools = filterTools(allTools, {
      ...mcpConfig,
      allowWrites: false,
      allowSends: false,
    });
    this.prompts = generatePrompts(readOnlyTools);

    await this.server.connect(new StdioServerTransport());

    logger.info(`Iterable MCP server v${packageJson.version} running on stdio`);
    logger.info(
      `Configuration: PII=${mcpConfig.allowUserPii}, Writes=${mcpConfig.allowWrites}, Sends=${mcpConfig.allowSends}`
    );
    logger.info(`Available tools: ${this.tools.length}`);
    logger.debug("Debug mode enabled");
  }
}

/**
 * Generate a cryptographically secure session ID
 * Uses crypto.randomUUID() for guaranteed uniqueness and unpredictability
 * Exported for testing purposes
 */
export function createSessionId(): string {
  return randomUUID();
}
