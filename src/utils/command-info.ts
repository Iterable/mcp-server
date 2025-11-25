/**
 * Shared utilities for command names and help text
 */

// Executable/package names
export const LOCAL_BINARY_NAME = "iterable-mcp";
export const NPX_PACKAGE_NAME = "@iterable/mcp";

/**
 * The command name based on how the CLI was invoked
 * (e.g., "iterable-mcp" or "npx @iterable/mcp")
 */
const isNpx =
  process.argv[1]?.includes("npx") || process.env.npm_execpath?.includes("npx");

export const COMMAND_NAME = isNpx
  ? `npx ${NPX_PACKAGE_NAME}`
  : LOCAL_BINARY_NAME;

/**
 * Keys command help table rows
 */
export const KEYS_COMMAND_TABLE: Array<[string, string]> = [
  [`${COMMAND_NAME} keys list`, "View all stored API keys"],
  [`${COMMAND_NAME} keys add`, "Add a new API key"],
  [`${COMMAND_NAME} keys update <name-or-id>`, "Update an existing key"],
  [`${COMMAND_NAME} keys activate <name-or-id>`, "Switch to a different key"],
  [`${COMMAND_NAME} keys delete <name-or-id>`, "Remove a key by ID or name"],
];
