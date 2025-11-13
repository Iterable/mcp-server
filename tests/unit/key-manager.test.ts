/**
 * Unit tests for KeyManager
 *
 * These tests mock the spawn function to test keychain operations without
 * actually modifying the macOS Keychain.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import * as crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";

import {
  getKeyManager,
  KeyManager as KeyManagerClass,
  type SecurityExecutor,
} from "../../src/key-manager.js";

// Will spy on randomUUID in beforeEach
let mockRandomUUID: jest.SpiedFunction<typeof crypto.randomUUID>;

describe("KeyManager", () => {
  let tempDir: string;
  let keyManager: KeyManagerClass;
  let mockExecSecurity: jest.MockedFunction<SecurityExecutor>;

  beforeEach(async () => {
    // Set up NODE_ENV for test-specific service name
    process.env.NODE_ENV = "test";

    // Set up spy for randomUUID
    mockRandomUUID = jest.spyOn(crypto, "randomUUID");

    // Default UUID mock - use proper UUID format
    mockRandomUUID.mockImplementation(
      () => "00000000-0000-0000-0000-000000000001"
    );

    // Create mock for execSecurity (prevents real keychain operations)
    mockExecSecurity = jest.fn(
      async (_args: string[]) => ""
    ) as unknown as jest.MockedFunction<SecurityExecutor>;
    mockExecSecurity.mockResolvedValue(""); // Default: successful operation

    // Create a temporary directory for test metadata
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "keymanager-test-"));

    // Inject mock execSecurity function
    keyManager = new KeyManagerClass(tempDir, mockExecSecurity);
  });

  afterEach(async () => {
    // Clean up temp directory (including lock files)
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Restore spies
    jest.restoreAllMocks();

    // Small delay to ensure all async operations complete
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  describe("Platform Support", () => {
    it("should throw on non-macOS platforms", () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", {
        value: "linux",
        configurable: true,
      });

      expect(() => new KeyManagerClass()).toThrow(
        "Key Manager only supports macOS"
      );

      // Restore
      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        configurable: true,
      });
    });
  });

  describe("initialize", () => {
    it("should create config directory if it doesn't exist", async () => {
      await keyManager.initialize();

      const stats = await fs.stat(tempDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should create empty metadata file on first init", async () => {
      await keyManager.initialize();

      const metadataPath = path.join(tempDir, "keys.json");
      const metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));

      expect(metadata).toEqual({
        keys: [],
        version: 1,
      });
    });

    it("should load existing metadata file", async () => {
      // Create metadata file
      const metadataPath = path.join(tempDir, "keys.json");
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(
        metadataPath,
        JSON.stringify({
          keys: [
            {
              id: "test-id",
              name: "test-key",
              baseUrl: "https://api.iterable.com",
              created: "2024-01-01T00:00:00.000Z",
              isActive: true,
            },
          ],
          version: 1,
        })
      );

      await keyManager.initialize();
      const keys = await keyManager.listKeys();

      expect(keys).toHaveLength(1);
      expect(keys[0]?.name).toBe("test-key");
    });
  });

  describe("addKey", () => {
    beforeEach(async () => {
      await keyManager.initialize();
    });

    it("should add a valid key", async () => {
      const id = await keyManager.addKey(
        "production",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );

      // Verify ID is a valid UUID
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );

      // Verify mock was called with correct arguments
      expect(mockExecSecurity).toHaveBeenCalledWith([
        "add-generic-password",
        "-a",
        id,
        "-s",
        "iterable-mcp", // Service name (constant, not test-specific)
        "-w",
        "a1b2c3d4e5f6789012345678901234ab",
        "-U",
      ]);

      const keys = await keyManager.listKeys();
      expect(keys).toHaveLength(1);
      expect(keys[0]).toMatchObject({
        id,
        name: "production",
        baseUrl: "https://api.iterable.com",
        isActive: true,
      });
    });

    it("should make first key active automatically", async () => {
      await keyManager.addKey(
        "key1",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );

      const keys = await keyManager.listKeys();
      expect(keys[0]?.isActive).toBe(true);
    });

    it("should not make second key active", async () => {
      await keyManager.addKey(
        "key1",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );
      await keyManager.addKey(
        "key2",
        "b1b2c3d4e5f6789012345678901234ab",
        "https://api.eu.iterable.com"
      );

      const keys = await keyManager.listKeys();
      expect(keys[0]?.isActive).toBe(true);
      expect(keys[1]?.isActive).toBe(false);
    });

    it("should reject duplicate key names", async () => {
      await keyManager.addKey(
        "production",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );

      await expect(
        keyManager.addKey(
          "production",
          "b1b2c3d4e5f6789012345678901234ab",
          "https://api.iterable.com"
        )
      ).rejects.toThrow('Key with name "production" already exists');
    });

    it("should reject empty key name", async () => {
      await expect(
        keyManager.addKey(
          "",
          "a1b2c3d4e5f6789012345678901234ab",
          "https://api.iterable.com"
        )
      ).rejects.toThrow("Key name is required");
    });

    it("should validate API key format", async () => {
      await expect(
        keyManager.addKey("test", "invalid-key", "https://api.iterable.com")
      ).rejects.toThrow(
        "API key must be a 32-character lowercase hexadecimal string"
      );
    });

    it("should reject uppercase in API key", async () => {
      await expect(
        keyManager.addKey(
          "test",
          "A1B2C3D4E5F6789012345678901234AB",
          "https://api.iterable.com"
        )
      ).rejects.toThrow(
        "API key must be a 32-character lowercase hexadecimal string"
      );
    });

    it("should reject non-HTTPS URLs", async () => {
      await expect(
        keyManager.addKey(
          "test",
          "a1b2c3d4e5f6789012345678901234ab",
          "http://api.iterable.com"
        )
      ).rejects.toThrow("Base URL must use HTTPS protocol for security");
    });

    it("should reject invalid URLs", async () => {
      await expect(
        keyManager.addKey(
          "test",
          "a1b2c3d4e5f6789012345678901234ab",
          "not-a-url"
        )
      ).rejects.toThrow("Invalid base URL format");
    });

    it("should accept localhost URLs for development", async () => {
      const id = await keyManager.addKey(
        "dev",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://localhost:3000"
      );

      // Verify ID is a valid UUID
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("should handle keychain storage failure", async () => {
      mockExecSecurity.mockRejectedValueOnce(
        new Error("Security command failed with code 1: Keychain error")
      );

      await expect(
        keyManager.addKey(
          "test",
          "a1b2c3d4e5f6789012345678901234ab",
          "https://api.iterable.com"
        )
      ).rejects.toThrow("Failed to store key in macOS Keychain");
    });
  });

  describe("listKeys", () => {
    beforeEach(async () => {
      await keyManager.initialize();
    });

    it("should return empty array when no keys exist", async () => {
      const keys = await keyManager.listKeys();
      expect(keys).toEqual([]);
    });

    it("should list all keys", async () => {
      mockRandomUUID
        .mockReturnValueOnce("00000000-0000-0000-0000-000000000001")
        .mockReturnValueOnce("00000000-0000-0000-0000-000000000002");

      await keyManager.addKey(
        "key1",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );
      await keyManager.addKey(
        "key2",
        "b1b2c3d4e5f6789012345678901234ab",
        "https://api.eu.iterable.com"
      );

      const keys = await keyManager.listKeys();
      expect(keys).toHaveLength(2);
      expect(keys[0]?.name).toBe("key1");
      expect(keys[1]?.name).toBe("key2");
    });

    it("should not return actual API keys", async () => {
      await keyManager.addKey(
        "test",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );

      const keys = await keyManager.listKeys();
      expect(keys[0]).not.toHaveProperty("apiKey");
    });
  });

  describe("getKey", () => {
    let testKeyId: string;

    beforeEach(async () => {
      await keyManager.initialize();
      testKeyId = await keyManager.addKey(
        "test-key",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );
    });

    it("should retrieve key by ID", async () => {
      // Mock the keychain response
      mockExecSecurity.mockResolvedValueOnce(
        "a1b2c3d4e5f6789012345678901234ab"
      );

      const apiKey = await keyManager.getKey(testKeyId);
      expect(apiKey).toBe("a1b2c3d4e5f6789012345678901234ab");
      expect(mockExecSecurity).toHaveBeenCalledWith([
        "find-generic-password",
        "-a",
        testKeyId,
        "-s",
        "iterable-mcp", // Service name (constant, not test-specific)
        "-w",
      ]);
    });

    it("should retrieve key by name", async () => {
      mockExecSecurity.mockResolvedValueOnce(
        "a1b2c3d4e5f6789012345678901234ab"
      );

      const apiKey = await keyManager.getKey("test-key");
      expect(apiKey).toBe("a1b2c3d4e5f6789012345678901234ab");
    });

    it("should return null for non-existent key", async () => {
      const apiKey = await keyManager.getKey("non-existent");
      expect(apiKey).toBeNull();
    });

    it("should handle keychain retrieval failure", async () => {
      mockExecSecurity.mockRejectedValueOnce(
        new Error("Security command failed with code 1: Key not found")
      );

      await expect(keyManager.getKey("test-key")).rejects.toThrow(
        "Failed to retrieve key from macOS Keychain"
      );
    });
  });

  describe("getActiveKey", () => {
    beforeEach(async () => {
      await keyManager.initialize();
    });

    it("should return null when no keys exist", async () => {
      const activeKey = await keyManager.getActiveKey();
      expect(activeKey).toBeNull();
    });

    it("should return the active key", async () => {
      await keyManager.addKey(
        "test",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );

      mockExecSecurity.mockResolvedValueOnce(
        "a1b2c3d4e5f6789012345678901234ab"
      );
      const activeKey = await keyManager.getActiveKey();
      expect(activeKey).toBe("a1b2c3d4e5f6789012345678901234ab");
    });
  });

  describe("getActiveKeyMetadata", () => {
    beforeEach(async () => {
      await keyManager.initialize();
    });

    it("should return null when no keys exist", async () => {
      const metadata = await keyManager.getActiveKeyMetadata();
      expect(metadata).toBeNull();
    });

    it("should return active key metadata", async () => {
      await keyManager.addKey(
        "test",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );

      const metadata = await keyManager.getActiveKeyMetadata();
      expect(metadata).toMatchObject({
        name: "test",
        baseUrl: "https://api.iterable.com",
        isActive: true,
      });
    });
  });

  describe("setActiveKey", () => {
    let key2Id: string;

    beforeEach(async () => {
      await keyManager.initialize();

      await keyManager.addKey(
        "key1",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );
      key2Id = await keyManager.addKey(
        "key2",
        "b1b2c3d4e5f6789012345678901234ab",
        "https://api.eu.iterable.com"
      );
    });

    it("should activate key by name", async () => {
      await keyManager.setActiveKey("key2");

      const keys = await keyManager.listKeys();
      expect(keys[0]?.isActive).toBe(false);
      expect(keys[1]?.isActive).toBe(true);
    });

    it("should activate key by ID", async () => {
      await keyManager.setActiveKey(key2Id);

      const keys = await keyManager.listKeys();
      expect(keys[0]?.isActive).toBe(false);
      expect(keys[1]?.isActive).toBe(true);
    });

    it("should deactivate other keys", async () => {
      await keyManager.setActiveKey("key2");
      await keyManager.setActiveKey("key1");

      const keys = await keyManager.listKeys();
      expect(keys[0]?.isActive).toBe(true);
      expect(keys[1]?.isActive).toBe(false);
    });

    it("should throw for non-existent key", async () => {
      await expect(keyManager.setActiveKey("non-existent")).rejects.toThrow(
        "Key not found"
      );
    });
  });

  describe("deleteKey", () => {
    let testKeyId: string;

    beforeEach(async () => {
      await keyManager.initialize();
      testKeyId = await keyManager.addKey(
        "test-key",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );
    });

    it("should delete key from keychain and metadata", async () => {
      // Add a second key and activate it so we can delete the first
      const secondKeyId = await keyManager.addKey(
        "second-key",
        "b1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );
      await keyManager.setActiveKey(secondKeyId);

      // Now delete the first key (which is no longer active)
      await keyManager.deleteKey(testKeyId);

      expect(mockExecSecurity).toHaveBeenCalledWith([
        "delete-generic-password",
        "-a",
        testKeyId,
        "-s",
        "iterable-mcp", // Service name (constant, not test-specific)
      ]);

      const keys = await keyManager.listKeys();
      expect(keys).toHaveLength(1);
      expect(keys[0]?.name).toBe("second-key");
    });

    it("should delete by ID", async () => {
      // Add a second key and activate it so we can delete the first
      const secondKeyId = await keyManager.addKey(
        "second-key",
        "b1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );
      await keyManager.setActiveKey(secondKeyId);

      // Now delete the first key (which is no longer active)
      await keyManager.deleteKey(testKeyId);

      const keys = await keyManager.listKeys();
      expect(keys).toHaveLength(1);
      expect(keys[0]?.name).toBe("second-key");
    });

    it("should prevent deleting the active key", async () => {
      const keys = await keyManager.listKeys();
      const activeKey = keys.find((k) => k.isActive);

      await expect(keyManager.deleteKey(activeKey!.id)).rejects.toThrow(
        "Cannot delete the currently active key"
      );
    });

    it("should continue if keychain deletion fails", async () => {
      // Add a second key and activate it so we can delete the first
      const secondKeyId = await keyManager.addKey(
        "second-key",
        "b1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );
      await keyManager.setActiveKey(secondKeyId);

      // Mock keychain deletion failure
      mockExecSecurity.mockRejectedValueOnce(
        new Error("Security command failed with code 1: Deletion failed")
      );

      // Should not throw
      await keyManager.deleteKey(testKeyId);

      // Metadata should still be removed
      const keys = await keyManager.listKeys();
      expect(keys).toHaveLength(1);
      expect(keys[0]?.name).toBe("second-key");
    });

    it("should throw for non-existent key", async () => {
      await expect(keyManager.deleteKey("non-existent-id")).rejects.toThrow(
        "Key not found with ID"
      );
    });
  });

  describe("hasKeys", () => {
    beforeEach(async () => {
      await keyManager.initialize();
    });

    it("should return false when no keys exist", async () => {
      const hasKeys = await keyManager.hasKeys();
      expect(hasKeys).toBe(false);
    });

    it("should return true when keys exist", async () => {
      await keyManager.addKey(
        "test",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );

      const hasKeys = await keyManager.hasKeys();
      expect(hasKeys).toBe(true);
    });
  });

  describe("migrateLegacyKey", () => {
    beforeEach(async () => {
      await keyManager.initialize();
    });

    it("should add legacy key with default name", async () => {
      const id = await keyManager.migrateLegacyKey(
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      );

      // Verify ID is a valid UUID
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );

      const keys = await keyManager.listKeys();
      expect(keys).toHaveLength(1);
      expect(keys[0]?.name).toBe("default");
    });

    it("should use custom name", async () => {
      await keyManager.migrateLegacyKey(
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com",
        "migrated"
      );

      const keys = await keyManager.listKeys();
      expect(keys[0]?.name).toBe("migrated");
    });

    it("should not duplicate if key already exists", async () => {
      const id1 = await keyManager.migrateLegacyKey(
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com",
        "default"
      );

      const id2 = await keyManager.migrateLegacyKey(
        "b1b2c3d4e5f6789012345678901234cd",
        "https://api.iterable.com",
        "default"
      );

      expect(id1).toBe(id2);

      const keys = await keyManager.listKeys();
      expect(keys).toHaveLength(1);
    });
  });

  describe("getKeyManager singleton", () => {
    // Skip on non-macOS since getKeyManager() requires macOS platform
    const testFn = process.platform === "darwin" ? it : it.skip;

    testFn("should return same instance", () => {
      const instance1 = getKeyManager();
      const instance2 = getKeyManager();

      expect(instance1).toBe(instance2);
    });
  });
});
