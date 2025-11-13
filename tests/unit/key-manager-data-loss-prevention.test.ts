/**
 * Tests to prevent data loss bugs in KeyManager
 *
 * These tests verify critical safety mechanisms:
 * 1. validateAndCleanup doesn't auto-delete metadata
 * 2. Backups are created before destructive operations
 * 3. NODE_ENV changes don't affect production data
 */

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import fs from "fs/promises";
import os from "os";
import path from "path";

import {
  KeyManager as KeyManagerClass,
  type SecurityExecutor,
} from "../../src/key-manager.js";

describe("KeyManager Data Loss Prevention", () => {
  let tempDir: string;
  let keyManager: KeyManagerClass;
  let mockExecSecurity: jest.MockedFunction<SecurityExecutor>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "keymanager-dataloss-test-")
    );
    mockExecSecurity = jest.fn(async () => "mock-key-value");
    keyManager = new KeyManagerClass(tempDir, mockExecSecurity);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Backup protection", () => {
    it("should create backup before overwriting keys.json with existing keys", async () => {
      await keyManager.initialize();

      // Add a key
      await keyManager.addKey(
        "prod",
        "abcd1234abcd1234abcd1234abcd1234",
        "https://api.iterable.com"
      );

      // Add another key (this should trigger backup)
      await keyManager.addKey(
        "staging",
        "ef1234567890abcdef1234567890abcd",
        "https://api.iterable.com"
      );

      // Open and read backup via file descriptor to avoid TOCTOU
      const backupFile = path.join(tempDir, "keys.json.backup");
      const fh = await fs.open(backupFile, "r").catch(() => null);
      expect(fh).not.toBeNull();
      const backupJson = await fh!.readFile("utf-8");
      await fh!.close();
      const backupData = JSON.parse(backupJson);
      expect(backupData.keys).toHaveLength(1);
      expect(backupData.keys[0].name).toBe("prod");
    });
  });

  describe("validateAndCleanup safety", () => {
    it("should NOT auto-delete metadata when keychain entries are missing", async () => {
      await keyManager.initialize();

      // Add a key
      await keyManager.addKey(
        "prod",
        "abcd1234abcd1234abcd1234abcd1234",
        "https://api.iterable.com"
      );

      // Mock keychain to return "not found" error (simulating missing keychain entry)
      mockExecSecurity.mockImplementation(async (args) => {
        if (args[0] === "find-generic-password") {
          throw new Error(
            "The specified item could not be found in the keychain."
          );
        }
        if (args[0] === "add-generic-password") {
          return "success";
        }
        return "mock-value";
      });

      // Re-initialize (triggers validateAndCleanup)
      const keyManager2 = new KeyManagerClass(tempDir, mockExecSecurity);
      await keyManager2.initialize();

      // Verify metadata was NOT deleted (this is the bug fix!)
      const keys = await keyManager2.listKeys();
      expect(keys).toHaveLength(1);
      const first = keys[0]!;
      expect(first.name).toBe("prod");
    });
  });

  describe("NODE_ENV isolation", () => {
    it("should use same SERVICE_NAME regardless of NODE_ENV", async () => {
      // Set NODE_ENV=test
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";

      try {
        await keyManager.initialize();
        await keyManager.addKey(
          "test-key",
          "abcd1234abcd1234abcd1234abcd1234",
          "https://api.iterable.com"
        );

        // Verify the security command was called with "iterable-mcp"
        const addKeyCalls = mockExecSecurity.mock.calls.filter(
          (call) => call[0]?.[0] === "add-generic-password"
        );
        expect(addKeyCalls.length).toBeGreaterThan(0);

        // Check the service name parameter (-s flag)
        const firstCall = addKeyCalls[0]!;
        const firstArgs = firstCall[0]!;
        const serviceNameIndex = firstArgs.indexOf("-s");
        expect(serviceNameIndex).toBeGreaterThan(-1);
        expect(firstArgs[serviceNameIndex + 1]).toBe("iterable-mcp");
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe("Concurrent access protection", () => {
    it("should not corrupt keys.json during concurrent saves", async () => {
      await keyManager.initialize();

      // Simulate concurrent additions
      const promises = [
        keyManager.addKey(
          "key1",
          "1234567812345678123456781234abcd",
          "https://api.iterable.com"
        ),
        keyManager.addKey(
          "key2",
          "abcdefabcdefabcdefabcdefabcdefab",
          "https://api.iterable.com"
        ),
        keyManager.addKey(
          "key3",
          "9876543298765432987654329876fedc",
          "https://api.iterable.com"
        ),
      ];

      await Promise.all(promises);

      // Verify all keys were saved
      const keys = await keyManager.listKeys();
      expect(keys).toHaveLength(3);

      // Verify the JSON file is valid (not corrupted)
      const metadataFile = path.join(tempDir, "keys.json");
      const data = await fs.readFile(metadataFile, "utf-8");
      const parsed = JSON.parse(data); // Should not throw
      expect(parsed.keys).toHaveLength(3);
    });
  });
});
