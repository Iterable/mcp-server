import type { McpServerConfig } from "../../src/config.js";

/**
 * Helper to create test config with required fields
 */
export function createTestConfig(
  overrides: Partial<McpServerConfig> = {}
): McpServerConfig {
  return {
    apiKey: "test-api-key",
    baseUrl: "https://api.iterable.com",
    allowUserPii: false,
    allowWrites: false,
    allowSends: false,
    ...overrides,
  };
}
