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
import * as child_process from "child_process";
import { EventEmitter } from "events";
import fs from "fs/promises";
import os from "os";
import path from "path";

import {
  KeyManager as KeyManagerClass,
  type SecurityExecutor,
} from "../../src/key-manager.js";

// Mock child_process.spawn
jest.mock("child_process", () => {
  return {
    spawn: jest.fn(),
  };
});

describe("KeyManager Windows DPAPI", () => {
  let tempDir: string;
  let keyManager: KeyManagerClass;
  let mockExecSecurity: jest.MockedFunction<SecurityExecutor>;
  let mockSpawn: jest.MockedFunction<typeof child_process.spawn>;

  beforeEach(async () => {
    // Set up NODE_ENV for test-specific service name
    process.env.NODE_ENV = "test";

    // Mock platform to be Windows
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });

    // Mock spawn
    mockSpawn = child_process.spawn as jest.MockedFunction<
      typeof child_process.spawn
    >;
    // Reset mock implementation to ensure clean state
    if (mockSpawn.mockReset) {
      mockSpawn.mockReset();
    }

    // Create mock for execSecurity (not used on Windows but required by constructor)
    mockExecSecurity = jest.fn(
      async (_args: string[]) => ""
    ) as unknown as jest.MockedFunction<SecurityExecutor>;

    // Create a temporary directory for test metadata
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "keymanager-dpapi-test-")
    );

    // Initialize KeyManager
    keyManager = new KeyManagerClass(tempDir, mockExecSecurity);
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

  /**
   * Helper to mock PowerShell execution
   * @param output The stdout output to simulate
   * @param exitCode The exit code to simulate (default 0)
   */
  function mockPowerShell(output: string, exitCode = 0) {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = {
      write: jest.fn(),
      end: jest.fn(),
    };

    mockSpawn.mockReturnValue(child);

    // Simulate process execution on next tick
    process.nextTick(() => {
      if (output) {
        child.stdout.emit("data", Buffer.from(output));
      }
      child.emit("close", exitCode);
    });

    return child;
  }

  it("should encrypt API key using DPAPI on Windows", async () => {
    // Mock encryption response (base64 encoded "encrypted" string)
    const encryptedValue = Buffer.from("encrypted-secret").toString("base64");
    mockPowerShell(encryptedValue);

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
    expect(metadata.keys[0].encryptedApiKey).toBe(encryptedValue);
    expect(metadata.keys[0].apiKey).toBeUndefined(); // Should not store plaintext

    // Verify PowerShell was called correctly
    expect(mockSpawn).toHaveBeenCalledWith(
      "powershell",
      expect.arrayContaining(["-Command", "-"]),
      expect.objectContaining({
        env: expect.objectContaining({
          ITERABLE_MCP_SECRET: "a1b2c3d4e5f6789012345678901234ab",
        }),
      })
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
    mockPowerShell("a1b2c3d4e5f6789012345678901234ab");

    // 3. Retrieve key
    const apiKey = await keyManager.getKey("test-id");

    expect(apiKey).toBe("a1b2c3d4e5f6789012345678901234ab");

    // Verify PowerShell was called with encrypted value in env var
    expect(mockSpawn).toHaveBeenCalledWith(
      "powershell",
      expect.arrayContaining(["-Command", "-"]),
      expect.objectContaining({
        env: expect.objectContaining({
          ITERABLE_MCP_SECRET: encryptedValue,
        }),
      })
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

    // 2. Retrieve key (should not call PowerShell)
    const apiKey = await keyManager.getKey("legacy-id");

    expect(apiKey).toBe("legacy-plaintext-key");
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("should handle encryption failure", async () => {
    // Mock PowerShell failure
    const child = mockPowerShell("Encryption failed", 1);
    // We need to manually emit stderr for the error message
    process.nextTick(() => {
      child.stderr.emit("data", Buffer.from("System error"));
    });

    await expect(
      keyManager.addKey(
        "fail-key",
        "a1b2c3d4e5f6789012345678901234ab",
        "https://api.iterable.com"
      )
    ).rejects.toThrow("Failed to encrypt key with Windows DPAPI");
  });
});
