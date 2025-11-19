/**
 * Secure API Key Management with cross-platform support
 *
 * This module provides secure storage and management of multiple Iterable API keys.
 *
 * Storage Strategy:
 * - macOS: API keys in Keychain, metadata in ~/.iterable-mcp/keys.json
 * - Windows: API keys encrypted with DPAPI in ~/.iterable-mcp/keys.json
 * - Linux: API keys and metadata in ~/.iterable-mcp/keys.json (mode 0o600)
 * - Lock file: ~/.iterable-mcp/keys.lock prevents concurrent modifications
 *
 * Security Features:
 * - API key format validation (32-char lowercase hex)
 * - HTTPS-only URL validation (except localhost)
 * - Duplicate key detection (both names and values)
 * - File-based locking for concurrent access protection
 * - Restrictive file permissions where supported (Linux/macOS)
 */

import { logger } from "@iterable/api";
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

import { isHttpsOrLocalhost, isLocalhostHost } from "./utils/url.js";

// Service name for keychain entries
// IMPORTANT: This must be constant to avoid data loss. Never use NODE_ENV here!
// Tests should use dependency injection with mock execSecurity instead.
const SERVICE_NAME = "iterable-mcp";

const execFileAsync = promisify(execFile);

/**
 * Safely execute macOS security command with proper argument escaping
 * Uses execFile to prevent shell injection vulnerabilities
 */
async function execSecurityDefault(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("security", args);
    return stdout.trim();
  } catch (error: any) {
    throw new Error(
      `Security command failed: ${error.stderr?.toString().trim() || error.message}`
    );
  }
}

// Type for the security executor function (for dependency injection in tests)
export type SecurityExecutor = (args: string[]) => Promise<string>;

export interface ApiKeyMetadata {
  /** Unique identifier for this key */
  id: string;
  /** User-friendly name for this key */
  name: string;
  /** Iterable API base URL (e.g., https://api.iterable.com or https://api.eu.iterable.com) */
  baseUrl: string;
  /** ISO timestamp when key was created */
  created: string;
  /** Whether this is the currently active key */
  isActive: boolean;
  /** Optional per-key environment overrides (extensible for future vars) */
  env?: Record<string, string>;
  /** API key value (only present when not using Keychain storage) */
  apiKey?: string;
  /** Encrypted API key (Windows DPAPI) */
  encryptedApiKey?: string;
}

interface KeyStore {
  /** Metadata for all stored keys */
  keys: ApiKeyMetadata[];
  /** Version of the storage format */
  version: number;
}

export class KeyManager {
  private readonly configDir: string;
  private readonly metadataFile: string;
  private readonly lockFile: string;
  private store: KeyStore | null = null;
  private saveLock: Promise<void> | null = null;
  private readonly execSecurity: SecurityExecutor;
  private readonly useKeychain: boolean;
  private readonly useDpapi: boolean;

  /**
   * Create a new KeyManager instance
   *
   * @param configDir - Optional custom config directory (defaults to ~/.iterable-mcp)
   * @param execSecurity - Optional security command executor (for dependency injection in tests)
   */
  constructor(configDir?: string, execSecurity?: SecurityExecutor) {
    this.configDir = configDir || path.join(os.homedir(), ".iterable-mcp");
    this.metadataFile = path.join(this.configDir, "keys.json");
    this.lockFile = path.join(this.configDir, "keys.lock");
    this.execSecurity = execSecurity || execSecurityDefault;

    // Determine storage method based on platform
    // Can be overridden via ITERABLE_MCP_FORCE_FILE_STORAGE=true
    const forceFileStorage =
      process.env.ITERABLE_MCP_FORCE_FILE_STORAGE === "true";

    // Use Keychain on macOS (or when mock execSecurity provided for tests)
    this.useKeychain =
      !forceFileStorage &&
      (process.platform === "darwin" || !!execSecurity) &&
      process.platform !== "win32";

    // Use DPAPI on Windows (but not if mock execSecurity provided - that's for Keychain tests)
    this.useDpapi =
      !forceFileStorage && process.platform === "win32" && !execSecurity;
  }

  /**
   * Validate metadata against keychain and clean up orphaned entries (macOS only)
   *
   * Checks if each key in metadata still exists in the keychain.
   * Removes any metadata entries that no longer have corresponding keychain entries.
   * This prevents sync issues when keychain entries are manually deleted.
   *
   * @returns Array of cleaned up key names (if any)
   */
  private async validateAndCleanup(): Promise<string[]> {
    // Only validate Keychain on macOS
    if (!this.useKeychain || !this.store || this.store.keys.length === 0) {
      return [];
    }

    const orphanedKeys: ApiKeyMetadata[] = [];

    // Check each key to see if it exists in keychain
    for (const keyMeta of this.store.keys) {
      try {
        await this.execSecurity([
          "find-generic-password",
          "-a",
          keyMeta.id,
          "-s",
          SERVICE_NAME,
          "-w",
        ]);
        // Key exists - no action needed
      } catch (error: any) {
        // Key doesn't exist in keychain - mark for removal
        if (error.message?.includes("could not be found")) {
          orphanedKeys.push(keyMeta);
        }
      }
    }

    if (orphanedKeys.length > 0) {
      // SAFETY: Don't automatically delete metadata if we can't find keychain entries
      // This could be a false positive due to keychain access issues, permissions, etc.
      const summary = orphanedKeys.map((k) => ({ id: k.id, name: k.name }));
      logger.warn(
        "Keychain mismatch detected; metadata NOT automatically deleted",
        {
          action: "NOT_DELETED",
          count: orphanedKeys.length,
        }
      );

      // Provide a concise, actionable console message for humans
      console.warn(
        "\n⚠️  Keychain mismatch detected: the following key(s) exist in metadata but not in macOS Keychain.\n"
      );
      for (const { id, name } of summary) {
        console.warn(`  • ${name}  (ID: ${id})`);
        console.warn(
          `    Delete from metadata:   iterable-mcp keys delete "${id}"`
        );
        console.warn(
          `    macOS manual cleanup: security delete-generic-password -a "${id}" -s "${SERVICE_NAME}"`
        );
      }
      console.warn("\nNext steps:");
      console.warn("  1) List keys:    iterable-mcp keys list");
      console.warn("  2) Delete any orphaned keys using the ID shown above");
      console.warn("  3) Re-run your command after cleanup\n");

      // DO NOT automatically delete the metadata!
      // Users should manually verify and clean up with 'keys delete' command
      // This prevents data loss from false positives (permissions, keychain locked, etc.)

      return orphanedKeys.map((k) => k.name);
    }

    return [];
  }

  /**
   * Acquire an exclusive lock for metadata operations
   *
   * Uses atomic file creation (wx flag = O_CREAT | O_EXCL) to prevent concurrent
   * modifications. Retries up to 20 times with 50ms delays (1 second total).
   * Fails safely if lock cannot be acquired rather than forcefully stealing it.
   *
   * Lock contention is rare since writes only happen during explicit user operations
   * (add, delete, activate keys) - no automatic updates.
   *
   * @returns An async unlock function that should be called in a finally block
   * @throws {Error} If lock cannot be acquired after 1 second timeout
   */
  private async acquireLock(): Promise<() => Promise<void>> {
    const maxAttempts = 20; // Max 20 attempts (1 second with 50ms delay)
    const maxLockAgeMs = 5 * 60 * 1000; // 5 minutes

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Try to create lock file exclusively (atomic operation)
        const lockData = JSON.stringify({
          pid: process.pid,
          created: Date.now(),
        });
        await fs.writeFile(this.lockFile, lockData, {
          // Create exclusively and set restrictive permissions on first write
          flag: "wx", // O_CREAT | O_EXCL - atomic, no TOCTOU
          mode: 0o600, // owner read/write only
        });

        // Successfully acquired lock - return unlock function
        return async () => {
          try {
            // Only remove the lock if it still belongs to this process
            const data = await fs
              .readFile(this.lockFile, "utf-8")
              .catch(() => "");
            if (data) {
              try {
                const parsed = JSON.parse(data);
                if (Number(parsed?.pid) !== process.pid) {
                  return; // Do not remove someone else's lock
                }
              } catch {
                // If unreadable, proceed to remove to avoid deadlocks
              }
            }
            await fs.unlink(this.lockFile);
          } catch {
            // Ignore errors during unlock (file may already be gone)
          }
        };
      } catch (error: any) {
        if (error.code !== "EEXIST") {
          // Unexpected error (permissions, disk full, etc.)
          throw error;
        }

        // Lock exists - attempt safe stale-lock recovery
        try {
          const raw = await fs.readFile(this.lockFile, "utf-8");
          const parsed = JSON.parse(raw || "{}");
          const pid = Number(parsed?.pid);
          const created = Number(parsed?.created);

          const isOld =
            Number.isFinite(created) && Date.now() - created > maxLockAgeMs;
          let pidAlive = true;
          if (Number.isFinite(pid) && pid > 0) {
            try {
              // Signal 0 checks for existence of the process on UNIX-like systems
              process.kill(pid, 0);
              pidAlive = true;
            } catch {
              pidAlive = false;
            }
          }

          if (isOld || !pidAlive) {
            // Safe to remove stale lock
            await fs.unlink(this.lockFile).catch(() => {});
          }
        } catch {
          // If we can't read/parse, just continue with normal retry
        }

        // Wait and retry
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    }

    // Timeout - fail rather than force acquisition (safer)
    throw new Error(
      "Failed to acquire lock: another process is modifying keys. Please try again."
    );
  }

  /**
   * Initialize the key manager
   *
   * Creates the configuration directory (mode 0o700) and loads existing metadata.
   * If the metadata file doesn't exist, creates a new empty store.
   * Uses idiomatic Node.js approach: try to read, handle ENOENT if file missing.
   * This method must be called before any other key management operations.
   *
   * @throws {Error} If the configuration directory cannot be created or metadata is corrupt
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true, mode: 0o700 });

      // Try to load existing metadata, create new if doesn't exist
      try {
        await this.loadMetadata();
      } catch (error: any) {
        if (error.code === "ENOENT") {
          // File doesn't exist - create new store
          this.store = {
            keys: [],
            version: 1,
          };
          await this.saveMetadata();
        } else {
          // Re-throw other errors (corrupt JSON, permissions, etc.)
          throw error;
        }
      }

      // Validate and clean up any orphaned metadata
      await this.validateAndCleanup();
    } catch (error) {
      logger.error("Failed to initialize key manager", { error });
      throw new Error(
        `Failed to initialize key manager: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Load metadata from disk (with locking)
   */
  private async loadMetadata(): Promise<void> {
    const unlock = await this.acquireLock();
    try {
      const data = await fs.readFile(this.metadataFile, "utf-8");
      this.store = JSON.parse(data);
    } finally {
      await unlock();
    }
  }

  /**
   * Create a backup of the metadata file before destructive operations
   */
  private async backupMetadata(): Promise<void> {
    try {
      const backupFile = `${this.metadataFile}.backup`;
      const data = await fs.readFile(this.metadataFile, "utf-8");
      await fs.writeFile(backupFile, data, { mode: 0o600 });
    } catch (error: any) {
      // If original file doesn't exist, that's ok - no backup needed
      if (error.code !== "ENOENT") {
        logger.warn("Failed to create metadata backup", { error });
      }
    }
  }

  /**
   * Save metadata to disk (with locking to prevent concurrent modifications)
   */
  private async saveMetadata(): Promise<void> {
    if (!this.store) {
      throw new Error("Key store not initialized");
    }

    // If a save is already in progress, wait for it
    if (this.saveLock) {
      await this.saveLock;
    }

    // Acquire lock and save
    this.saveLock = (async () => {
      const unlock = await this.acquireLock();
      try {
        // Create backup before saving if file exists and has keys
        try {
          const existingData = await fs.readFile(this.metadataFile, "utf-8");
          const existing = JSON.parse(existingData);
          if (existing.keys && existing.keys.length > 0) {
            // Only backup if we're about to overwrite a file with keys
            await this.backupMetadata();
          }
        } catch {
          // Ignore errors reading existing file
        }

        await fs.writeFile(
          this.metadataFile,
          JSON.stringify(this.store, null, 2),
          { mode: 0o600 }
        );
      } catch (error) {
        logger.error("Failed to save key metadata", { error });
        throw new Error(
          `Failed to save key metadata: ${error instanceof Error ? error.message : String(error)}`
        );
      } finally {
        await unlock();
        this.saveLock = null;
      }
    })();

    await this.saveLock;
  }

  /**
   * Generate a unique ID for a key
   * Uses UUID v4 for guaranteed uniqueness and no collision risk
   */
  private generateId(): string {
    return randomUUID();
  }

  /**
   * Validate API key format
   */
  private validateApiKey(apiKey: string): void {
    if (!apiKey) {
      throw new Error("API key is required");
    }
    if (!/^[a-f0-9]{32}$/.test(apiKey)) {
      throw new Error(
        "API key must be a 32-character lowercase hexadecimal string"
      );
    }
  }

  /**
   * Validate and normalize base URL
   */
  private validateBaseUrl(baseUrl: string): void {
    if (!baseUrl) {
      throw new Error("Base URL is required");
    }

    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch (error) {
      throw new Error(
        `Invalid base URL format: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Require HTTPS for security, except allow http for localhost during local development
    if (!isHttpsOrLocalhost(url)) {
      throw new Error(
        "Base URL must use HTTPS protocol for security. Insecure HTTP is only permitted for localhost."
      );
    }

    // Warn if not a standard Iterable domain
    const isIterableDomain =
      url.hostname === "iterable.com" || url.hostname.endsWith(".iterable.com");
    const isLocalhost = isLocalhostHost(url.hostname);

    if (!isIterableDomain && !isLocalhost) {
      logger.warn("Non-standard Iterable domain detected", {
        hostname: url.hostname,
      });
      console.warn(
        `⚠️  Warning: Using non-standard Iterable domain: ${url.hostname}`
      );
    }
  }

  /**
   * Encrypt data using Windows DPAPI
   *
   * Security: Uses native C++ bindings to Windows DPAPI (Data Protection API).
   * - No shell execution or code evaluation
   * - Encrypted data can only be decrypted by the same user on the same machine
   * - Uses CurrentUser scope for user-level protection
   * - No optional entropy parameter (null) for simplicity
   *
   * @param text - Plain text to encrypt (validated as 32-char hex by caller)
   * @returns Base64-encoded encrypted blob
   * @throws {Error} If DPAPI encryption fails or platform is not Windows
   */
  private async encryptWindows(text: string): Promise<string> {
    if (process.platform !== "win32") {
      throw new Error("DPAPI encryption is only supported on Windows");
    }

    try {
      // Dynamic import to avoid loading native module on non-Windows platforms
      const { Dpapi } = await import("@primno/dpapi");

      // Convert string to buffer (UTF-8 encoding)
      const plainBuffer = Buffer.from(text, "utf-8");

      // Encrypt using DPAPI (returns Uint8Array)
      // Parameters: data, optionalEntropy (null), scope ("CurrentUser")
      const encryptedBytes = Dpapi.protectData(
        plainBuffer,
        null,
        "CurrentUser"
      );

      // Convert to Buffer and encode as base64 for JSON storage
      return Buffer.from(encryptedBytes).toString("base64");
    } catch (error) {
      logger.error("DPAPI encryption failed", { error });
      throw new Error(
        `Failed to encrypt data with Windows DPAPI: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Decrypt data using Windows DPAPI
   *
   * Security: Uses native C++ bindings to Windows DPAPI.
   * - No shell execution or code evaluation
   * - Only the user who encrypted the data can decrypt it
   * - Validates base64 input before decryption
   *
   * @param encryptedBase64 - Base64-encoded encrypted blob
   * @returns Decrypted plain text
   * @throws {Error} If DPAPI decryption fails, data is corrupt, or platform is not Windows
   */
  private async decryptWindows(encryptedBase64: string): Promise<string> {
    if (process.platform !== "win32") {
      throw new Error("DPAPI decryption is only supported on Windows");
    }

    // Validate base64 format to prevent invalid data from reaching DPAPI
    if (!/^[A-Za-z0-9+/]+=*$/.test(encryptedBase64)) {
      throw new Error("Invalid encrypted data format (not valid base64)");
    }

    try {
      // Dynamic import to avoid loading native module on non-Windows platforms
      const { Dpapi } = await import("@primno/dpapi");

      // Decode base64 to buffer
      const encryptedBuffer = Buffer.from(encryptedBase64, "base64");

      // Decrypt using DPAPI (returns Uint8Array)
      // Parameters: encryptedData, optionalEntropy (null), scope ("CurrentUser")
      const decryptedBytes = Dpapi.unprotectData(
        encryptedBuffer,
        null,
        "CurrentUser"
      );

      // Convert to Buffer and decode as UTF-8
      return Buffer.from(decryptedBytes).toString("utf-8");
    } catch (error) {
      logger.error("DPAPI decryption failed", { error });
      throw new Error(
        `Failed to decrypt data with Windows DPAPI: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Add a new API key
   *
   * Stores an API key securely (Keychain on macOS, file on other platforms).
   *
   * @param name - User-friendly name for the key (must be unique)
   * @param apiKey - 32-character lowercase hexadecimal Iterable API key
   * @param baseUrl - Iterable API base URL (must be HTTPS)
   * @returns The unique ID generated for this key
   * @throws {Error} If the key name already exists, validation fails, or storage fails
   */
  async addKey(
    name: string,
    apiKey: string,
    baseUrl: string,
    envOverrides?: Record<string, string>
  ): Promise<string> {
    if (!this.store) {
      await this.initialize();
    }

    if (!this.store) {
      throw new Error("Key store not initialized");
    }

    // Validate inputs
    if (!name || name.trim().length === 0) {
      throw new Error("Key name is required");
    }

    this.validateApiKey(apiKey);
    this.validateBaseUrl(baseUrl);

    // Check for duplicate names
    if (this.store.keys.some((k) => k.name === name)) {
      throw new Error(`Key with name "${name}" already exists`);
    }

    // Generate unique ID
    const id = this.generateId();

    // If this is the first key, make it active
    const isActive = this.store.keys.length === 0;

    // Create metadata
    const metadata: ApiKeyMetadata = {
      id,
      name,
      baseUrl,
      created: new Date().toISOString(),
      isActive,
      ...(envOverrides && Object.keys(envOverrides).length > 0
        ? { env: envOverrides }
        : {}),
    };

    // Store API key
    if (this.useKeychain) {
      // macOS: Store in Keychain
      try {
        await this.execSecurity([
          "add-generic-password",
          "-a",
          id,
          "-s",
          SERVICE_NAME,
          "-w",
          apiKey,
          "-U",
        ]);
      } catch (error) {
        logger.error("Failed to store key in keychain", { error, id });
        throw new Error(
          `Failed to store key in macOS Keychain: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else if (this.useDpapi) {
      // Windows: Store encrypted in JSON
      try {
        metadata.encryptedApiKey = await this.encryptWindows(apiKey);
      } catch (error) {
        logger.error("Failed to encrypt key with DPAPI", { error, id });
        throw new Error(
          `Failed to encrypt key with Windows DPAPI: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else {
      // Linux/Other: Store in JSON
      metadata.apiKey = apiKey;
    }

    // Store metadata
    this.store.keys.push(metadata);
    await this.saveMetadata();

    return id;
  }

  /**
   * Update per-key environment overrides for an existing key
   */
  async updateKeyEnv(
    idOrName: string,
    envOverrides: Record<string, string>
  ): Promise<void> {
    if (!this.store) {
      await this.initialize();
    }
    if (!this.store) {
      throw new Error("Key store not initialized");
    }
    const keyMeta = this.store.keys.find(
      (k) => k.id === idOrName || k.name === idOrName
    );
    if (!keyMeta) {
      throw new Error(`Key not found: ${idOrName}`);
    }
    keyMeta.env = { ...(keyMeta.env || {}), ...envOverrides };
    await this.saveMetadata();
  }

  /**
   * List all keys (metadata only, not the actual keys)
   *
   * Returns metadata for all stored API keys including names, IDs, base URLs,
   * timestamps, and active status. Does NOT return the actual API key values.
   *
   * @returns Array of API key metadata
   * @throws {Error} If the key store is not initialized
   */
  async listKeys(): Promise<ApiKeyMetadata[]> {
    if (!this.store) {
      await this.initialize();
    }

    if (!this.store) {
      throw new Error("Key store not initialized");
    }

    return [...this.store.keys];
  }

  /**
   * Get a key by ID or name
   *
   * Retrieves the actual API key value from storage.
   *
   * @param idOrName - The unique ID or user-friendly name of the key
   * @returns The API key value, or null if not found
   * @throws {Error} If storage access fails
   */
  async getKey(idOrName: string): Promise<string | null> {
    if (!this.store) {
      await this.initialize();
    }

    if (!this.store) {
      throw new Error("Key store not initialized");
    }

    // Find the key metadata
    const keyMeta = this.store.keys.find(
      (k) => k.id === idOrName || k.name === idOrName
    );

    if (!keyMeta) {
      return null;
    }

    // Get API key
    if (this.useKeychain) {
      // macOS: Get from Keychain
      try {
        const apiKey = await this.execSecurity([
          "find-generic-password",
          "-a",
          keyMeta.id,
          "-s",
          SERVICE_NAME,
          "-w",
        ]);

        if (!apiKey) {
          logger.error("Key not found in keychain", { id: keyMeta.id });
          throw new Error(
            `Key not found in macOS Keychain for ID ${keyMeta.id}`
          );
        }

        return apiKey;
      } catch (error) {
        logger.error("Failed to retrieve key from keychain", {
          error,
          id: keyMeta.id,
        });
        throw new Error(
          `Failed to retrieve key from macOS Keychain: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } else if (this.useDpapi) {
      // Windows: Decrypt from JSON
      if (keyMeta.encryptedApiKey) {
        try {
          return await this.decryptWindows(keyMeta.encryptedApiKey);
        } catch (error) {
          logger.error("Failed to decrypt key with DPAPI", {
            error,
            id: keyMeta.id,
          });
          throw new Error(
            `Failed to decrypt key with Windows DPAPI: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } else if (keyMeta.apiKey) {
        // Fallback for legacy keys stored in plaintext on Windows
        return keyMeta.apiKey;
      } else {
        logger.error("Key not found in metadata", { id: keyMeta.id });
        throw new Error(`Key not found in storage for ID ${keyMeta.id}`);
      }
    } else {
      // Linux/Other: Get from JSON
      if (!keyMeta.apiKey) {
        logger.error("Key not found in metadata", { id: keyMeta.id });
        throw new Error(`Key not found in storage for ID ${keyMeta.id}`);
      }
      return keyMeta.apiKey;
    }
  }

  /**
   * Get the currently active key
   *
   * Retrieves the API key value for whichever key is currently marked as active.
   * Only one key can be active at a time.
   *
   * @returns The active API key value, or null if no key is active
   * @throws {Error} If storage access fails
   */
  async getActiveKey(): Promise<string | null> {
    if (!this.store) {
      await this.initialize();
    }

    if (!this.store) {
      throw new Error("Key store not initialized");
    }

    const activeKey = this.store.keys.find((k) => k.isActive);
    if (!activeKey) {
      return null;
    }

    return this.getKey(activeKey.id);
  }

  /**
   * Get the active key metadata
   *
   * Returns metadata for the currently active key without retrieving the
   * actual API key value.
   *
   * @returns The active key metadata, or null if no key is active
   * @throws {Error} If the key store is not initialized
   */
  async getActiveKeyMetadata(): Promise<ApiKeyMetadata | null> {
    if (!this.store) {
      await this.initialize();
    }

    if (!this.store) {
      throw new Error("Key store not initialized");
    }

    return this.store.keys.find((k) => k.isActive) || null;
  }

  /**
   * Set a key as active by ID or name
   *
   * Marks the specified key as active and deactivates all other keys.
   * The active key's base URL and API key will be used by the MCP server.
   * Only one key can be active at a time.
   *
   * @param idOrName - The unique ID or user-friendly name of the key to activate
   * @throws {Error} If the key is not found or the store is not initialized
   */
  async setActiveKey(idOrName: string): Promise<void> {
    if (!this.store) {
      await this.initialize();
    }

    if (!this.store) {
      throw new Error("Key store not initialized");
    }

    // Find the key
    const keyMeta = this.store.keys.find(
      (k) => k.id === idOrName || k.name === idOrName
    );

    if (!keyMeta) {
      throw new Error(`Key not found: ${idOrName}`);
    }

    // Deactivate all keys
    this.store.keys.forEach((k) => {
      k.isActive = false;
    });

    // Activate the selected key
    keyMeta.isActive = true;

    await this.saveMetadata();
  }

  /**
   * Delete a key by ID
   *
   * Removes a key from storage and the metadata store.
   * The currently active key cannot be deleted - you must activate a different
   * key first.
   *
   * Note: Only accepts key ID (not name) since IDs are guaranteed unique.
   *
   * @param id - The unique ID of the key to delete
   * @throws {Error} If the key is not found, is currently active, or the store is not initialized
   */
  async deleteKey(id: string): Promise<void> {
    if (!this.store) {
      await this.initialize();
    }

    if (!this.store) {
      throw new Error("Key store not initialized");
    }

    // Find the key by ID only
    const index = this.store.keys.findIndex((k) => k.id === id);

    if (index === -1) {
      throw new Error(`Key not found with ID: ${id}`);
    }

    const keyMeta = this.store.keys[index]!;

    // Prevent deletion of the active key
    if (keyMeta.isActive) {
      throw new Error(
        `Cannot delete the currently active key "${keyMeta.name}". Please activate a different key first.`
      );
    }

    // Delete from storage
    if (this.useKeychain) {
      // macOS: Delete from Keychain
      let keychainDeleted = false;
      try {
        await this.execSecurity([
          "delete-generic-password",
          "-a",
          keyMeta.id,
          "-s",
          SERVICE_NAME,
        ]);
        keychainDeleted = true;
      } catch (error) {
        logger.error("Failed to delete key from keychain", {
          error,
          id: keyMeta.id,
        });
        // Continue anyway to clean up metadata, but warn the user
      }

      // Remove from metadata
      this.store.keys.splice(index, 1);
      await this.saveMetadata();

      if (!keychainDeleted) {
        logger.warn(
          "Key removed from metadata but may still exist in Keychain",
          {
            id: keyMeta.id,
            name: keyMeta.name,
          }
        );
        console.warn(
          `⚠️  Warning: Key "${keyMeta.name}" removed from metadata but may still exist in Keychain.`
        );
        console.warn(
          `    To manually remove: security delete-generic-password -a "${keyMeta.id}" -s "${SERVICE_NAME}"`
        );
      } else {
        logger.info("API key deleted", { id: keyMeta.id, name: keyMeta.name });
      }
    } else {
      // Windows/Linux: Just remove from JSON
      this.store.keys.splice(index, 1);
      await this.saveMetadata();
      logger.info("API key deleted", { id: keyMeta.id, name: keyMeta.name });
    }
  }

  /**
   * Check if any keys exist
   *
   * Returns true if at least one API key has been stored in the key manager.
   *
   * @returns True if keys exist, false otherwise
   * @throws {Error} If the key store is not initialized
   */
  async hasKeys(): Promise<boolean> {
    if (!this.store) {
      await this.initialize();
    }

    if (!this.store) {
      throw new Error("Key store not initialized");
    }

    return this.store.keys.length > 0;
  }

  /**
   * Find a key by its actual API key value
   *
   * Checks all stored keys to see if the given API key value already exists.
   * Useful for preventing duplicate key values.
   *
   * @param apiKeyValue - The API key value to search for
   * @returns The metadata of the matching key, or null if not found
   * @throws {Error} If storage access fails
   */
  async findKeyByValue(apiKeyValue: string): Promise<ApiKeyMetadata | null> {
    if (!this.store) {
      await this.initialize();
    }

    if (!this.store) {
      throw new Error("Key store not initialized");
    }

    // Check each key to see if the value matches
    for (const keyMeta of this.store.keys) {
      try {
        let storedKey: string;

        if (this.useKeychain) {
          // macOS: Check Keychain
          storedKey = await this.execSecurity([
            "find-generic-password",
            "-a",
            keyMeta.id,
            "-s",
            SERVICE_NAME,
            "-w",
          ]);
        } else if (this.useDpapi) {
          // Windows: Check DPAPI
          if (keyMeta.encryptedApiKey) {
            storedKey = await this.decryptWindows(keyMeta.encryptedApiKey);
          } else if (keyMeta.apiKey) {
            storedKey = keyMeta.apiKey;
          } else {
            continue;
          }
        } else {
          // Linux/Other: Check JSON
          if (!keyMeta.apiKey) {
            continue;
          }
          storedKey = keyMeta.apiKey;
        }

        if (storedKey.trim() === apiKeyValue) {
          return keyMeta;
        }
      } catch {
        // Skip keys that can't be retrieved (may have been manually deleted)
        continue;
      }
    }

    return null;
  }

  /**
   * Migrate a legacy API key from environment variable
   *
   * Adds an API key to the key manager with a default name if it doesn't
   * already exist. This is used during the migration path from environment
   * variable-based configuration to key manager storage.
   *
   * @param apiKey - The 32-character lowercase hexadecimal API key to migrate
   * @param baseUrl - The Iterable API base URL for this key
   * @param name - The name to assign (defaults to "default")
   * @returns The unique ID of the migrated key (existing or newly created)
   * @throws {Error} If validation fails or storage fails
   */
  async migrateLegacyKey(
    apiKey: string,
    baseUrl: string,
    name = "default"
  ): Promise<string> {
    // Check if a key with this name already exists
    if (!this.store) {
      await this.initialize();
    }

    if (!this.store) {
      throw new Error("Key store not initialized");
    }

    const existing = this.store.keys.find((k) => k.name === name);
    if (existing) {
      logger.info("Legacy key already migrated", { name });
      return existing.id;
    }

    // Add the legacy key
    logger.info("Migrating legacy API key", { name });
    return this.addKey(name, apiKey, baseUrl);
  }
}

// Singleton instance
let keyManagerInstance: KeyManager | null = null;

/**
 * Get the singleton KeyManager instance
 */
export function getKeyManager(): KeyManager {
  if (!keyManagerInstance) {
    keyManagerInstance = new KeyManager();
  }
  return keyManagerInstance;
}
