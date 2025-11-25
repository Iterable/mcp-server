import { describe, expect, it, jest } from "@jest/globals";

import type { ApiKeyMetadata } from "../../src/key-manager.js";

const listKeysMock = jest.fn<() => Promise<ApiKeyMetadata[]>>();

jest.mock("../../src/key-manager.js", () => {
  const mock = {
    async initialize() {},
    async listKeys() {
      return listKeysMock();
    },
  };
  return {
    __esModule: true,
    getKeyManager: () => mock,
  };
});

jest.mock("inquirer", () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
}));

// Mock UI module
jest.mock("../../src/utils/ui.js", () => ({
  __esModule: true,
  createTable: () => ({ push: () => {}, toString: () => "" }),
  formatKeyValue: (_k: string, v: string) => v,
  icons: { key: "", globe: "", lock: "", zap: "", bulb: "", fire: "" },
  showBox: () => {},
  showError: () => {},
  showInfo: () => {},
  showIterableLogo: () => {},
  showSection: () => {},
  showSuccess: () => {},
  linkColor: () => (s: string) => s,
}));

jest.mock("chalk", () => ({
  __esModule: true,
  default: new Proxy(() => "", {
    get: () =>
      new Proxy(() => "", {
        get: () => () => (s: any) => s,
        apply: (_t, _this, args) => args[0],
      }),
    apply: (_t, _this, args) => args[0],
  }),
}));

// Silence output
const consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "clear").mockImplementation(() => {});

// Mock process.exit to prevent test from actually exiting, but throw to stop execution
const mockExit = jest.spyOn(process, "exit").mockImplementation(((
  code: any
) => {
  throw new Error(`process.exit(${code})`);
}) as any);

describe("findKeyOrExit helper", () => {
  const testKeys = [
    {
      id: "11111111-2222-3333-4444-555555555555",
      name: "production",
      baseUrl: "https://api.iterable.com",
      created: new Date().toISOString(),
      isActive: true,
    },
    {
      id: "22222222-3333-4444-5555-666666666666",
      name: "staging",
      baseUrl: "https://api.iterable.com",
      created: new Date().toISOString(),
      isActive: false,
    },
    {
      id: "33333333-4444-5555-6666-777777777777",
      name: "My Production Key",
      baseUrl: "https://api.iterable.com",
      created: new Date().toISOString(),
      isActive: false,
    },
  ];

  beforeEach(() => {
    listKeysMock.mockClear();
    consoleLogSpy.mockClear();
    mockExit.mockClear();
    listKeysMock.mockResolvedValue(testKeys);
  });

  it("exits with error when key name/id is not provided", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "cli", "keys", "activate"]; // missing key argument

    const { handleKeysCommand } = await import("../../src/keys-cli.js");

    try {
      await handleKeysCommand();
    } catch (error: any) {
      expect(error.message).toBe("process.exit(1)");
    }

    // The main assertion: process.exit should be called with error code
    expect(mockExit).toHaveBeenCalledWith(1);

    process.argv = originalArgv;
  });

  it("exits with error when key not found", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "cli", "keys", "activate", "nonexistent"];

    const { handleKeysCommand } = await import("../../src/keys-cli.js");

    try {
      await handleKeysCommand();
    } catch (error: any) {
      expect(error.message).toBe("process.exit(1)");
    }

    // The main assertion: process.exit should be called when key not found
    expect(mockExit).toHaveBeenCalledWith(1);

    process.argv = originalArgv;
  });

  it("exits with error for partial match (not exact)", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "cli", "keys", "activate", "prod"]; // partial match

    const { handleKeysCommand } = await import("../../src/keys-cli.js");

    try {
      await handleKeysCommand();
    } catch (error: any) {
      expect(error.message).toBe("process.exit(1)");
    }

    // Should exit even with partial matches (findKeyOrExit requires exact match)
    expect(mockExit).toHaveBeenCalledWith(1);

    process.argv = originalArgv;
  });
});
