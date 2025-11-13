/**
 * Simple graceful shutdown handling for the MCP server
 */

import { createIterableConfig } from "@iterable/api";
import { logger } from "@iterable/api";

// Get config for shutdown timeout
const config = (() => {
  try {
    const iterableConfig = createIterableConfig();
    return { SHUTDOWN_TIMEOUT: iterableConfig.timeout || 30000 };
  } catch {
    return { SHUTDOWN_TIMEOUT: 30000 };
  }
})();

let isShuttingDown = false;

async function shutdown(
  signal: string,
  handler?: () => Promise<void>
): Promise<void> {
  if (isShuttingDown) {
    logger.info("Shutdown already in progress");
    return;
  }

  isShuttingDown = true;
  logger.info("Starting graceful shutdown", { signal });

  const shutdownStart = Date.now();

  try {
    if (handler) {
      // Run shutdown handler with timeout
      await Promise.race([
        handler(),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`Shutdown timeout after ${config.SHUTDOWN_TIMEOUT}ms`)
              ),
            config.SHUTDOWN_TIMEOUT
          )
        ),
      ]);
    }

    const duration = Date.now() - shutdownStart;
    logger.info("Graceful shutdown completed", { duration });
    process.exit(0);
  } catch (error) {
    logger.error("Graceful shutdown failed", {
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - shutdownStart,
    });
    process.exit(1);
  }
}

export function setupGracefulShutdown(handler?: () => Promise<void>): void {
  // Register signal handlers
  const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];

  signals.forEach((signal) => {
    process.once(signal, () => {
      void shutdown(signal, handler);
    });
  });

  // Handle uncaught errors
  process.once("uncaughtException", (error) => {
    logger.error("Uncaught exception, shutting down", {
      error: error.message,
      stack: error.stack,
    });
    void shutdown("uncaughtException", handler);
  });

  process.once("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection, shutting down", {
      reason: String(reason),
    });
    void shutdown("unhandledRejection", handler);
  });
}
