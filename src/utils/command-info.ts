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

/** Published documentation site (docsify on GitHub Pages) */
export const DOCUMENTATION_URL = "https://iterable.github.io/mcp-server/";

/** Shown during keys add/update when --advanced is not passed */
export const KEYS_ADVANCED_HINT =
  "Pass --advanced with add/update to choose PII, writes, and sends.";

/** Shown before the permission checkbox prompt (setup/keys --advanced) */
export const ADVANCED_PERMISSIONS_WARNING =
  "If you enable writes or sends, the agent can take real, potentially irreversible actions (sending messages, deleting data). Enable only if you can review each tool call, especially in production.";

/** Muted hint on help screens when auto theme detection may be wrong */
export const UI_THEME_HINT =
  "Colors hard to read? Set ITERABLE_UI_THEME=dark or light.";

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
