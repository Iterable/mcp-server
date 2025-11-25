import { logger } from "@iterable/api";

import { getKeyManager } from "./key-manager.js";
import { COMMAND_NAME } from "./utils/command-info.js";
import { sanitizeString } from "./utils/sanitize.js";

/**
 * Configuration for MCP server restrictions
 */

export interface McpServerConfig {
  /** If false, exclude tools that can access or return user PII */
  readonly allowUserPii: boolean;
  /** If false, exclude tools that perform write operations */
  readonly allowWrites: boolean;
  /** If false, exclude tools that can send messages (campaign/journey/event-triggered sends) */
  readonly allowSends: boolean;
  /** The active Iterable API key */
  readonly apiKey: string;
  /** The Iterable API base URL */
  readonly baseUrl: string;
}

export function resolveAllowFlags(
  keyEnv: Record<string, string> | undefined,
  env: NodeJS.ProcessEnv
): { allowUserPii: boolean; allowWrites: boolean; allowSends: boolean } {
  const allowUserPii =
    (keyEnv?.ITERABLE_USER_PII ?? env.ITERABLE_USER_PII) === "true";
  const allowWrites =
    (keyEnv?.ITERABLE_ENABLE_WRITES ?? env.ITERABLE_ENABLE_WRITES) === "true";
  const allowSends =
    (keyEnv?.ITERABLE_ENABLE_SENDS ?? env.ITERABLE_ENABLE_SENDS) === "true";
  return { allowUserPii, allowWrites, allowSends };
}

/**
 * Load configuration from environment variables and key manager
 */
export async function loadMcpServerConfig(): Promise<McpServerConfig> {
  let apiKey: string | null = null;
  let baseUrl: string =
    process.env.ITERABLE_BASE_URL || "https://api.iterable.com";
  let keyEnv: Record<string, string> | undefined;

  // SAFETY: Skip keyManager in test environments to prevent production data access
  if (process.env.NODE_ENV !== "test") {
    try {
      const keyManager = getKeyManager();
      await keyManager.initialize();

      // Check if we have stored keys
      if (await keyManager.hasKeys()) {
        apiKey = await keyManager.getActiveKey();
        // Get the base URL from the active key metadata
        const activeKeyMetadata = await keyManager.getActiveKeyMetadata();
        if (activeKeyMetadata?.baseUrl) {
          baseUrl = activeKeyMetadata.baseUrl;
        }
        if (activeKeyMetadata?.env) {
          keyEnv = activeKeyMetadata.env;
        }
      }

      // If no stored keys and ITERABLE_API_KEY env var exists, migrate it
      if (!apiKey && process.env.ITERABLE_API_KEY) {
        await keyManager.migrateLegacyKey(
          process.env.ITERABLE_API_KEY,
          baseUrl
        );
        apiKey = await keyManager.getActiveKey();
      }
    } catch (error) {
      // Distinguish between expected "no keys" vs unexpected errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (
        errorMessage.includes("Key store not initialized") ||
        errorMessage.includes("No API key found")
      ) {
        // Expected - no keys stored yet, will fall back to env
        logger.debug(
          "No keys in key manager, falling back to environment variable"
        );
      } else {
        // Unexpected error - log more details (sanitized to prevent key leakage)
        const sanitizedMessage = sanitizeString(errorMessage);
        logger.error("Unexpected error loading from key manager", {
          error: sanitizedMessage,
        });
        console.error(
          "⚠️  Warning: Failed to load API key from key storage:",
          sanitizedMessage
        );

        // Provide helpful guidance for sync issues (macOS Keychain specific)
        if (
          process.platform === "darwin" &&
          sanitizedMessage.includes("could not be found")
        ) {
          console.error(
            "\n💡 This may be a sync issue. Restarting the server will automatically clean up orphaned keys."
          );
        }

        console.error(
          "   Falling back to ITERABLE_API_KEY environment variable"
        );
      }
    }
  }

  // Fall back to environment variable if key manager didn't work
  if (!apiKey && process.env.ITERABLE_API_KEY) {
    apiKey = process.env.ITERABLE_API_KEY;
  }

  if (!apiKey) {
    throw new Error(
      `No API key found. Please run '${COMMAND_NAME} setup' or set ITERABLE_API_KEY environment variable.`
    );
  }

  const { allowUserPii, allowWrites, allowSends } = resolveAllowFlags(
    keyEnv,
    process.env
  );
  return { allowUserPii, allowWrites, allowSends, apiKey, baseUrl };
}
