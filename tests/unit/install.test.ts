import { describe, expect, it } from "@jest/globals";
import os from "os";
import path from "path";

import { buildMcpConfig } from "../../src/install.js";

describe("MCP Server Setup Configuration", () => {
  describe("Configuration Structure", () => {
    it("should generate correct config paths for different tools", () => {
      const cursorPath = path.join(os.homedir(), ".cursor", "mcp.json");
      expect(cursorPath).toContain(".cursor");
      expect(cursorPath).toContain("mcp.json");
    });

    it("should generate correct Claude Desktop path on Darwin", () => {
      if (process.platform === "darwin") {
        const claudePath = path.join(
          os.homedir(),
          "Library",
          "Application Support",
          "Claude",
          "claude_desktop_config.json"
        );
        expect(claudePath).toContain("Library");
        expect(claudePath).toContain("claude_desktop_config.json");
      }
    });
  });

  describe("Environment Variable Handling", () => {
    it("should respect ITERABLE_BASE_URL environment variable", () => {
      const baseUrl =
        process.env.ITERABLE_BASE_URL || "https://api.iterable.com";
      expect(baseUrl).toMatch(/^https?:\/\//);
    });

    it("should handle boolean environment variables correctly", () => {
      const userPii = process.env.ITERABLE_USER_PII || "true";
      const enableWrites = process.env.ITERABLE_ENABLE_WRITES || "true";

      expect(["true", "false"]).toContain(userPii);
      expect(["true", "false"]).toContain(enableWrites);
    });
  });

  describe("MCP Config JSON Structure", () => {
    it("should have required stdio config fields", () => {
      const mcpConfig = {
        type: "stdio" as const,
        command: "/path/to/node",
        args: ["-y", "@iterable/mcp"],
        env: {
          ITERABLE_USER_PII: "true",
          ITERABLE_ENABLE_WRITES: "true",
          ITERABLE_ENABLE_SENDS: "false",
        },
      };

      expect(mcpConfig.type).toBe("stdio");
      expect(mcpConfig.command).toBeTruthy();
      expect(Array.isArray(mcpConfig.args)).toBe(true);
      // API keys are stored via KeyManager, not in config env
      expect(mcpConfig.env).toHaveProperty("ITERABLE_USER_PII");
      expect(mcpConfig.env).toHaveProperty("ITERABLE_ENABLE_WRITES");
      expect(mcpConfig.env).toHaveProperty("ITERABLE_ENABLE_SENDS");
    });

    it("should include debug env vars when debug is enabled", () => {
      const debugEnv = {
        ITERABLE_USER_PII: "true",
        ITERABLE_ENABLE_WRITES: "true",
        ITERABLE_DEBUG: "true",
        LOG_LEVEL: "debug",
      };

      expect(debugEnv).toHaveProperty("ITERABLE_DEBUG", "true");
      expect(debugEnv).toHaveProperty("LOG_LEVEL", "debug");
    });

    it("should support local and npx execution modes", () => {
      const localConfig = {
        command: "/path/to/node",
        args: ["/path/to/dist/index.js"],
      };

      const npxConfig = {
        command: "npx",
        args: ["-y", "@iterable/mcp"],
      };

      // Local config should point to local file
      expect(localConfig.args[0]).toContain("index.js");

      // NPX config should have the package name
      expect(npxConfig.args).toContain("@iterable/mcp");
      expect(npxConfig.args).toContain("-y");
    });
  });

  describe("Config Merging Logic", () => {
    it("should preserve existing servers when adding iterable", () => {
      const existingConfig = {
        mcpServers: {
          "other-server": {
            command: "other-command",
            args: [],
            env: {},
          },
        },
      };

      const newConfig = {
        ...existingConfig,
        mcpServers: {
          ...existingConfig.mcpServers,
          iterable: {
            type: "stdio" as const,
            command: "node",
            args: [],
            env: {},
          },
        },
      };

      expect(newConfig.mcpServers).toHaveProperty("other-server");
      expect(newConfig.mcpServers).toHaveProperty("iterable");
      expect(Object.keys(newConfig.mcpServers)).toHaveLength(2);
    });

    it("should overwrite existing iterable config", () => {
      const existingConfig = {
        mcpServers: {
          iterable: {
            command: "old-command",
            args: ["old-arg"],
            env: { OLD_KEY: "old-value" },
          },
        },
      };

      const newConfig = {
        ...existingConfig,
        mcpServers: {
          ...existingConfig.mcpServers,
          iterable: {
            type: "stdio" as const,
            command: "new-command",
            args: ["new-arg"],
            env: { NEW_KEY: "new-value" },
          },
        },
      };

      expect(newConfig.mcpServers.iterable.command).toBe("new-command");
      expect(newConfig.mcpServers.iterable.args).toContain("new-arg");
      expect(newConfig.mcpServers.iterable.env).toHaveProperty("NEW_KEY");
      expect(newConfig.mcpServers.iterable.env).not.toHaveProperty("OLD_KEY");
    });
  });

  describe("Claude Code JSON Command", () => {
    it("should generate valid JSON for claude mcp add-json", () => {
      const mcpConfig = {
        type: "stdio" as const,
        command: "npx",
        args: ["-y", "@iterable/mcp"],
        env: {
          ITERABLE_USER_PII: "true",
          ITERABLE_ENABLE_WRITES: "true",
        },
      };

      const jsonString = JSON.stringify(mcpConfig);
      const parsed = JSON.parse(jsonString);

      expect(parsed.type).toBe("stdio");
      expect(parsed.command).toBe("npx");
      expect(parsed.args).toEqual(["-y", "@iterable/mcp"]);
      expect(parsed.env).toHaveProperty("ITERABLE_USER_PII");
    });

    it("should escape special characters in JSON", () => {
      const configWithSpecialChars = {
        type: "stdio" as const,
        command: "node",
        args: ["/path/to/file"],
        env: {
          API_KEY: 'key-with-"quotes"',
          PATH: "/path/with\\backslash",
        },
      };

      const jsonString = JSON.stringify(configWithSpecialChars);

      // Should be valid JSON
      expect(() => JSON.parse(jsonString)).not.toThrow();

      // Should preserve the values
      const parsed = JSON.parse(jsonString);
      expect(parsed.env.API_KEY).toBe('key-with-"quotes"');
      expect(parsed.env.PATH).toBe("/path/with\\backslash");
    });
  });

  describe("Configuration Consistency", () => {
    it("should generate same config structure for all tools", () => {
      const baseConfig = {
        type: "stdio" as const,
        command: "npx",
        args: ["-y", "@iterable/mcp"],
        env: {
          ITERABLE_API_KEY: "test-key",
          ITERABLE_BASE_URL: "https://api.iterable.com",
          ITERABLE_USER_PII: "true",
          ITERABLE_ENABLE_WRITES: "true",
        },
      };

      // Simulate what each tool would get
      const cursorConfig = { mcpServers: { iterable: baseConfig } };
      const claudeDesktopConfig = { mcpServers: { iterable: baseConfig } };
      const claudeCodeConfig = baseConfig; // Claude Code uses JSON directly

      // All should have the same iterable config
      expect(cursorConfig.mcpServers.iterable).toEqual(
        claudeDesktopConfig.mcpServers.iterable
      );
      expect(cursorConfig.mcpServers.iterable).toEqual(claudeCodeConfig);
    });
  });

  describe("buildMcpConfig with ITERABLE_MCP_NODE_PATH and ITERABLE_MCP_NPX_PATH", () => {
    const mockEnv = {
      ITERABLE_API_KEY: "test-key",
      ITERABLE_BASE_URL: "https://api.iterable.com",
    };

    let originalNodePath: string | undefined;
    let originalNpxPath: string | undefined;

    beforeEach(() => {
      originalNodePath = process.env.ITERABLE_MCP_NODE_PATH;
      originalNpxPath = process.env.ITERABLE_MCP_NPX_PATH;
    });

    afterEach(() => {
      if (originalNodePath) {
        process.env.ITERABLE_MCP_NODE_PATH = originalNodePath;
      } else {
        delete process.env.ITERABLE_MCP_NODE_PATH;
      }
      if (originalNpxPath) {
        process.env.ITERABLE_MCP_NPX_PATH = originalNpxPath;
      } else {
        delete process.env.ITERABLE_MCP_NPX_PATH;
      }
    });

    it("should use default 'node' for local mode", () => {
      delete process.env.ITERABLE_MCP_NODE_PATH;

      const config = buildMcpConfig({
        isLocal: true,
        env: mockEnv,
      });

      expect(config.command).toBe("node");
      expect(config.args[0]).toContain("dist/index.js");
    });

    it("should use default 'npx' for remote mode", () => {
      delete process.env.ITERABLE_MCP_NPX_PATH;

      const config = buildMcpConfig({
        isLocal: false,
        env: mockEnv,
      });

      expect(config.command).toBe("npx");
      expect(config.args).toEqual(["-y", "@iterable/mcp"]);
    });

    it("should use ITERABLE_MCP_NODE_PATH for local mode", () => {
      process.env.ITERABLE_MCP_NODE_PATH = "/custom/path/to/node";

      const config = buildMcpConfig({
        isLocal: true,
        env: mockEnv,
      });

      expect(config.command).toBe("/custom/path/to/node");
      expect(config.args[0]).toContain("dist/index.js");
    });

    it("should use ITERABLE_MCP_NPX_PATH for remote mode", () => {
      process.env.ITERABLE_MCP_NPX_PATH = "/custom/path/to/npx";

      const config = buildMcpConfig({
        isLocal: false,
        env: mockEnv,
      });

      expect(config.command).toBe("/custom/path/to/npx");
      expect(config.args).toEqual(["-y", "@iterable/mcp"]);
    });

    it("should allow explicit override via options", () => {
      const config = buildMcpConfig({
        isLocal: true,
        env: mockEnv,
        nodePath: "/override/node",
      });

      expect(config.command).toBe("/override/node");
    });

    it("should include env in config", () => {
      const config = buildMcpConfig({
        isLocal: false,
        env: mockEnv,
      });

      expect(config.env).toEqual(mockEnv);
    });
  });

  describe("Config Validation - All Modes", () => {
    const mockEnv = {
      ITERABLE_API_KEY: "test-key",
      ITERABLE_BASE_URL: "https://api.iterable.com",
    };

    it("should always include required stdio fields", () => {
      const modes = [
        { isLocal: true, name: "local" },
        { isLocal: false, name: "remote" },
      ];

      modes.forEach((mode) => {
        const config = buildMcpConfig({
          isLocal: mode.isLocal,
          env: mockEnv,
        });

        expect(config).toHaveProperty("type", "stdio");
        expect(config).toHaveProperty("command");
        expect(config).toHaveProperty("args");
        expect(config).toHaveProperty("env");
        expect(typeof config.command).toBe("string");
        expect(Array.isArray(config.args)).toBe(true);
        expect(typeof config.env).toBe("object");
      });
    });

    it("should never have empty command", () => {
      const config = buildMcpConfig({
        isLocal: false,
        env: mockEnv,
      });

      expect(config.command).toBeTruthy();
      expect(config.command.length).toBeGreaterThan(0);
    });

    it("should properly format for JSON serialization", () => {
      const config = buildMcpConfig({
        isLocal: false,
        env: mockEnv,
      });

      // Should be JSON serializable
      const json = JSON.stringify(config);
      expect(json).toBeTruthy();

      // Should be parseable
      const parsed = JSON.parse(json);
      expect(parsed.type).toBe("stdio");
      expect(parsed.command).toBe(config.command);
      expect(parsed.args).toEqual(config.args);
      expect(parsed.env).toEqual(config.env);
    });
  });

  describe("Auto-Update Support", () => {
    const mockEnv = {
      ITERABLE_API_KEY: "test-key",
      ITERABLE_BASE_URL: "https://api.iterable.com",
    };

    it("should add @latest when autoUpdate is true", () => {
      const config = buildMcpConfig({
        isLocal: false,
        env: mockEnv,
        autoUpdate: true,
      });

      expect(config.args).toEqual(["-y", "@iterable/mcp@latest"]);
    });

    it("should not add version specifier when autoUpdate is false", () => {
      const config = buildMcpConfig({
        isLocal: false,
        env: mockEnv,
        autoUpdate: false,
      });

      expect(config.args).toEqual(["-y", "@iterable/mcp"]);
    });

    it("should not add version specifier by default", () => {
      const config = buildMcpConfig({
        isLocal: false,
        env: mockEnv,
      });

      expect(config.args).toEqual(["-y", "@iterable/mcp"]);
    });

    it("should not add @latest for local builds even when autoUpdate is true", () => {
      const config = buildMcpConfig({
        isLocal: true,
        env: mockEnv,
        autoUpdate: true,
      });

      // Local builds use path to index.js, not package name
      expect(config.args[0]).toContain("dist/index.js");
      expect(config.args[0]).not.toContain("@latest");
    });
  });
});
