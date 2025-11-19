/**
 * Integration tests for Windows DPAPI support in KeyManager
 *
 * These tests run ONLY on Windows and perform REAL encryption/decryption
 * using the OS DPAPI via PowerShell.
 */

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { KeyManager } from "../../src/key-manager.js";

// Skip entire suite if not on Windows
const describeWindows = process.platform === "win32" ? describe : describe.skip;

describeWindows("KeyManager Windows DPAPI Integration (Live)", () => {
  let tempDir: string;
  let keyManager: KeyManager;

  beforeEach(async () => {
    // Create a temporary directory for test metadata
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "keymanager-dpapi-live-")
    );

    // Initialize KeyManager with real execution (no mocks)
    keyManager = new KeyManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should encrypt and decrypt a key using real DPAPI", async () => {
    const keyName = "live-test-key";
    const apiKey = "a1b2c3d4e5f6789012345678901234ab";
    const baseUrl = "https://api.iterable.com";

    // 1. Add key (should encrypt)
    const id = await keyManager.addKey(keyName, apiKey, baseUrl);
    expect(id).toBeDefined();

    // 2. Verify file content is encrypted
    const metadataPath = path.join(tempDir, "keys.json");
    const metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));

    expect(metadata.keys).toHaveLength(1);
    const storedKey = metadata.keys[0];
    expect(storedKey.encryptedApiKey).toBeDefined();
    expect(storedKey.apiKey).toBeUndefined();
    expect(storedKey.encryptedApiKey).not.toBe(apiKey); // Should not be plaintext

    // 3. Retrieve key (should decrypt)
    const retrievedKey = await keyManager.getKey(id);
    expect(retrievedKey).toBe(apiKey);
  }, 30000); // Increase timeout for PowerShell execution

  it("should handle multiple keys", async () => {
    const key1 = "a1b2c3d4e5f6789012345678901234ab";
    const key2 = "b1b2c3d4e5f6789012345678901234cd";

    const id1 = await keyManager.addKey(
      "key1",
      key1,
      "https://api.iterable.com"
    );
    const id2 = await keyManager.addKey(
      "key2",
      key2,
      "https://api.eu.iterable.com"
    );

    const retrieved1 = await keyManager.getKey(id1);
    const retrieved2 = await keyManager.getKey(id2);

    expect(retrieved1).toBe(key1);
    expect(retrieved2).toBe(key2);
  }, 60000);
});
