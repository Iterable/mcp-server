/**
 * Unit tests for tool filtering system
 */

import { logger } from "@iterable/api";
import { describe, expect, it } from "@jest/globals";

import type { McpServerConfig } from "../../src/config.js";
import {
  filterTools,
  NON_PII_TOOLS,
  READ_ONLY_TOOLS,
} from "../../src/tool-filter.js";
import { createAllTools } from "../../src/tools/index.js";

// Mock Iterable client for testing
const mockClient = {} as any;

describe("Tool Filter", () => {
  const allTools = createAllTools(mockClient);
  const allToolNames = new Set(allTools.map((tool) => tool.name));

  describe("Safe tool lists validation", () => {
    it("should have all NON_PII_TOOLS in actual tool names", () => {
      // Get the safe non-PII tools by testing with restrictive config
      const restrictiveConfig: McpServerConfig = {
        allowUserPii: false,
        allowWrites: true, // Allow writes to isolate PII filtering
        allowSends: true,
      };

      const nonPiiTools = filterTools(allTools, restrictiveConfig);
      const nonPiiToolNames = nonPiiTools.map((tool) => tool.name);

      // Every tool in the filtered list should exist in actual tools
      nonPiiToolNames.forEach((toolName) => {
        expect(allToolNames.has(toolName)).toBe(true);
      });
    });

    it("should have all READ_ONLY_TOOLS in actual tool names", () => {
      // Get the read-only tools by testing with restrictive config
      const restrictiveConfig: McpServerConfig = {
        allowUserPii: true, // Allow PII to isolate write filtering
        allowWrites: false,
        allowSends: true,
      };

      const readOnlyTools = filterTools(allTools, restrictiveConfig);
      const readOnlyToolNames = readOnlyTools.map((tool) => tool.name);

      // Every tool in the filtered list should exist in actual tools
      readOnlyToolNames.forEach((toolName) => {
        expect(allToolNames.has(toolName)).toBe(true);
      });
    });

    it("should not have any unknown tools in safe lists", () => {
      for (const toolName of NON_PII_TOOLS) {
        expect(allToolNames.has(toolName)).toBe(true);
      }

      for (const toolName of READ_ONLY_TOOLS) {
        expect(allToolNames.has(toolName)).toBe(true);
      }

      logger.info(`Total tools: ${allTools.length}`);
      logger.info(`Safe non-PII tools: ${NON_PII_TOOLS.size}`);
      logger.info(`Safe read-only tools: ${READ_ONLY_TOOLS.size}`);
    });

    it("should filter tools when restrictions are applied", () => {
      const permissiveConfig: McpServerConfig = {
        allowUserPii: true,
        allowWrites: true,
        allowSends: true,
      };

      const restrictivePiiConfig: McpServerConfig = {
        allowUserPii: false,
        allowWrites: true,
        allowSends: true,
      };

      const restrictiveWriteConfig: McpServerConfig = {
        allowUserPii: true,
        allowWrites: false,
        allowSends: true,
      };

      const allToolsCount = filterTools(allTools, permissiveConfig).length;
      const nonPiiToolsCount = filterTools(
        allTools,
        restrictivePiiConfig
      ).length;
      const readOnlyToolsCount = filterTools(
        allTools,
        restrictiveWriteConfig
      ).length;

      expect(nonPiiToolsCount).toBeLessThan(allToolsCount);
      expect(readOnlyToolsCount).toBeLessThan(allToolsCount);
      expect(nonPiiToolsCount).toBe(NON_PII_TOOLS.size);
      expect(readOnlyToolsCount).toBe(READ_ONLY_TOOLS.size);
    });
  });

  describe("Configuration filtering", () => {
    it("should filter PII tools when allowUserPii is false", () => {
      const config: McpServerConfig = {
        allowUserPii: false,
        allowWrites: true,
        allowSends: true,
      };

      const filteredTools = filterTools(allTools, config);
      const filteredNames = filteredTools.map((tool) => tool.name);

      const piiTools = [
        "get_user_by_email",
        "get_user_by_user_id",
        "export_data",
        "export_user_events",
        "get_user_events",
        "get_list_users",
        "get_sent_messages",
      ];

      piiTools.forEach((toolName) => {
        if (allToolNames.has(toolName)) {
          expect(filteredNames).not.toContain(toolName);
        }
      });
    });

    it("should filter write tools when allowWrites is false", () => {
      const config: McpServerConfig = {
        allowUserPii: true,
        allowWrites: false,
        allowSends: true,
      };

      const filteredTools = filterTools(allTools, config);
      const filteredNames = filteredTools.map((tool) => tool.name);

      const writeTools = [
        "create_campaign",
        "update_user",
        "delete_user_by_email",
        "delete_user_by_user_id",
        "update_email",
        "update_user_subscriptions",
        "send_email",
        "create_snippet",
        "track_event",
      ];

      writeTools.forEach((toolName) => {
        if (allToolNames.has(toolName)) {
          expect(filteredNames).not.toContain(toolName);
        }
      });
    });

    it("should allow all tools when both restrictions are disabled", () => {
      const config: McpServerConfig = {
        allowUserPii: true,
        allowWrites: true,
        allowSends: true,
      };

      const filteredTools = filterTools(allTools, config);
      expect(filteredTools).toHaveLength(allTools.length);
    });

    it("should apply both restrictions when both are enabled", () => {
      const config: McpServerConfig = {
        allowUserPii: false,
        allowWrites: false,
        allowSends: false,
      };

      const filteredTools = filterTools(allTools, config);

      expect(filteredTools.length).toBeLessThan(allTools.length);

      const filteredNames = filteredTools.map((tool) => tool.name);
      const safeBothRestrictions = [
        "get_campaigns",
        "get_campaign_metrics",
        "get_templates",
        "get_snippets",
      ];

      safeBothRestrictions.forEach((toolName) => {
        if (allToolNames.has(toolName)) {
          expect(filteredNames).toContain(toolName);
        }
      });
    });
  });
});
