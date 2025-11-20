/**
 * Unit tests for Windows DPAPI support in KeyManager
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import fs from "fs/promises";
import os from "os";
import path from "path";

import { KeyManager as KeyManagerClass } from "../../src/key-manager.js";

// Mock @primno/dpapi module
jest.mock("@primno/dpapi", () => {
  return {
    Dpapi: {
      protectData: jest.fn(),
      unprotectData: jest.fn(),
    },
    isPlatformSupported: true,
  };
});

describe("KeyManager Windows DPAPI", () => {
  let tempDir: string;
  let keyManager: KeyManagerClass;
  let mockProtectData: jest.MockedFunction<any>;
  let mockUnprotectData: jest.MockedFunction<any>;

  beforeEach(async () => {
    // Set up NODE_ENV for test-specific service name
    process.env.NODE_ENV = "test";

    // Mock platform to be Windows
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });

    // Get mocked DPAPI functions
    const dpapiModule = await import("@primno/dpapi");
    mockProtectData = dpapiModule.Dpapi.protectData as jest.MockedFunction<any>;
    mockUnprotectData = dpapiModule.Dpapi
      .unprotectData as jest.MockedFunction<any>;

    // Reset mocks
    mockProtectData.mockReset();
    mockUnprotectData.mockReset();

    // Create a temporary directory for test metadata
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "keymanager-dpapi-test-")
    );

    // Initialize KeyManager WITHOUT execSecurity so it uses DPAPI mode on Windows
    // Passing execSecurity would force Keychain mode for tests
    keyManager = new KeyManagerClass(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    jest.restoreAllMocks();
  });

  it("should encrypt API key using DPAPI on Windows", async () => {
    // Mock encryption response
    const encryptedBytes = Buffer.from("encrypted-secret");
    mockProtectData.mockReturnValue(encryptedBytes);

    const id = await keyManager.addKey(
      "windows-key",
      "a1b2c3d4e5f6789012345678901234ab",
      "https://api.iterable.com"
    );
    expect(id).toBeDefined();

    // Verify metadata file contains encrypted key
    const metadataPath = path.join(tempDir, "keys.json");
    const metadata = JSON.parse(await fs.readFile(metadataPath, "utf-8"));

    expect(metadata.keys).toHaveLength(1);
    expect(metadata.keys[0].encryptedApiKey).toBe(
      encryptedBytes.toString("base64")
    );
    expect(metadata.keys[0].apiKey).toBeUndefined(); // Should not store plaintext

    // Verify DPAPI was called correctly
    expect(mockProtectData).toHaveBeenCalledWith(
      Buffer.from("a1b2c3d4e5f6789012345678901234ab", "utf-8"),
      null,
      "CurrentUser"
    );
  });

  it("should decrypt API key using DPAPI on Windows", async () => {
    // 1. Setup: Create metadata with encrypted key manually
    const encryptedValue = Buffer.from("encrypted-secret").toString("base64");
    const metadataPath = path.join(tempDir, "keys.json");
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(
      metadataPath,
      JSON.stringify({
        keys: [
          {
            id: "test-id",
            name: "windows-key",
            baseUrl: "https://api.iterable.com",
            created: new Date().toISOString(),
            isActive: true,
            encryptedApiKey: encryptedValue,
          },
        ],
        version: 1,
      })
    );

    // 2. Mock decryption response
    mockUnprotectData.mockReturnValue(
      Buffer.from("a1b2c3d4e5f6789012345678901234ab", "utf-8")
    );

    // 3. Retrieve key
    const apiKey = await keyManager.getKey("test-id");

    expect(apiKey).toBe("a1b2c3d4e5f6789012345678901234ab");

    // Verify DPAPI was called with encrypted value
    expect(mockUnprotectData).toHaveBeenCalledWith(
      Buffer.from(encryptedValue, "base64"),
      null,
      "CurrentUser"
    );
  });

  it("should handle legacy plaintext keys on Windows", async () => {
    // 1. Setup: Create metadata with plaintext key (legacy format)
    const metadataPath = path.join(tempDir, "keys.json");
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(
      metadataPath,
      JSON.stringify({
        keys: [
          {
            id: "legacy-id",
            name: "legacy-key",
            baseUrl: "https://api.iterable.com",
            created: new Date().toISOString(),
            isActive: true,
            apiKey: "legacy-plaintext-key",
          },
        ],
        version: 1,
      })
    );

    // 2. Retrieve key (should not call DPAPI)
    const apiKey = await keyManager.getKey("legacy-id");

    expect(apiKey).toBe("legacy-plaintext-key");
    expect(mockProtectData).not.toHaveBeenCalled();
    expect(mockUnprotectData).not.toHaveBeenCalled();
  });

  it("should handle encryption failure", async () => {
    // Mock DPAPI failure
    mockProtectData.mockImplementation(() => {
      throw new Error("DPAPI encryption failed");
    });

    await expect(
      keyManager.addKey(
        "fail-key",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      )
    ).rejects.toThrow("Failed to encrypt key with Windows DPAPI");
  });

  it("should handle decryption failure", async () => {
    // 1. Setup: Create metadata with encrypted key
    const encryptedValue = Buffer.from("encrypted-secret").toString("base64");
    const metadataPath = path.join(tempDir, "keys.json");
    await fs.mkdir(tempDir, { recursive: true });
    await fs.writeFile(
      metadataPath,
      JSON.stringify({
        keys: [
          {
            id: "test-id",
            name: "windows-key",
            baseUrl: "https://api.iterable.com",
            created: new Date().toISOString(),
            isActive: true,
            encryptedApiKey: encryptedValue,
          },
        ],
        version: 1,
      })
    );

    // 2. Mock DPAPI failure
    mockUnprotectData.mockImplementation(() => {
      throw new Error("DPAPI decryption failed");
    });

    // 3. Attempt to retrieve key
    await expect(keyManager.getKey("test-id")).rejects.toThrow(
      "Failed to decrypt key with Windows DPAPI"
    );
  });
});
