/**
 * Tests for preview tools PII restriction fix
 * Verifies that preview tools require PII permissions
 */

import { describe, expect, it } from "@jest/globals";

import type { McpServerConfig } from "../../src/config.js";
import { filterTools, NON_PII_TOOLS } from "../../src/tool-filter.js";
import { createAllTools } from "../../src/tools/index.js";

const mockClient = {} as any;

describe("Preview Tools PII Restriction", () => {
  const allTools = createAllTools(mockClient);

  it("should NOT include preview_email_template in NON_PII_TOOLS", () => {
    expect(NON_PII_TOOLS.has("preview_email_template")).toBe(false);
  });

  it("should NOT include preview_inapp_template in NON_PII_TOOLS", () => {
    expect(NON_PII_TOOLS.has("preview_inapp_template")).toBe(false);
  });

  it("should block preview tools when PII is disabled", () => {
    const noPiiConfig: McpServerConfig = {
      allowUserPii: false,
      allowWrites: true,
      allowSends: true,
    };

    const filteredTools = filterTools(allTools, noPiiConfig);
    const toolNames = filteredTools.map((t) => t.name);

    // Preview tools should be blocked when PII is disabled
    expect(toolNames).not.toContain("preview_email_template");
    expect(toolNames).not.toContain("preview_inapp_template");
  });

  it("should allow preview tools when PII is enabled", () => {
    const piiEnabledConfig: McpServerConfig = {
      allowUserPii: true,
      allowWrites: false,
      allowSends: false,
    };

    const filteredTools = filterTools(allTools, piiEnabledConfig);
    const toolNames = filteredTools.map((t) => t.name);

    // Preview tools should be available when PII is enabled
    expect(toolNames).toContain("preview_email_template");
    expect(toolNames).toContain("preview_inapp_template");
  });
});

