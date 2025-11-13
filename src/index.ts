#!/usr/bin/env node
/* eslint-disable no-console */
import { assertSupportedRuntime } from "./utils/runtime-check.js";
// Preflight: fail fast on unsupported Node versions and missing regex features
try {
  assertSupportedRuntime();
} catch (e) {
  console.error("\n❌ Unsupported Node.js environment\n");
  console.error((e as Error).message);
  process.exit(1);
}
import { logger } from "@iterable/api";

import { setupMcpServer } from "./install.js";
import { handleKeysCommand } from "./keys-cli.js";
import { IterableMcpServer } from "./server.js";

// Handle CLI arguments
const args = process.argv.slice(2);
const command = args[0];

// Key management commands
if (command === "keys") {
  handleKeysCommand().catch((error: Error) => {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  });
} else if (
  command === "setup" ||
  args.includes("--help") ||
  args.includes("-h")
) {
  // Run setup (handles its own help)
  setupMcpServer().catch((error: Error) => {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  });
} else {
  // Start MCP server (when called by AI tools)
  const server = new IterableMcpServer();
  server
    .run()
    .catch((error) => logger.error(`Failed to start MCP server ${error}`));
}
