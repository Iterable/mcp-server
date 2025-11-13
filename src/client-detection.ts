import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

/**
 * Simple client detection that uses MCP handshake information.
 * Only checks MCP_SOURCE override, then uses client-provided name directly.
 */
export function detectClientName(server?: Server): string {
  // 1) Explicit override
  if (process.env.MCP_SOURCE) {
    return process.env.MCP_SOURCE.toLowerCase();
  }

  // 2) Use client info from MCP handshake
  try {
    const clientInfo = server?.getClientVersion();
    if (clientInfo?.name) {
      return clientInfo.name.toLowerCase();
    }
  } catch {
    // Ignore handshake errors
  }

  return "unknown";
}
