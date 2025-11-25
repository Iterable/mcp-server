import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import type { ApiKeyMetadata } from "../../src/key-manager.js";

const updateKeyMock =
  jest.fn<
    (
      id: string,
      name: string,
      apiKey: string,
      baseUrl: string,
      env: Record<string, string>
    ) => Promise<string>
  >();
const getKeyMock = jest.fn<(id: string) => Promise<string>>();
const listKeysMock = jest.fn<() => Promise<ApiKeyMetadata[]>>();

jest.mock("../../src/key-manager.js", () => {
  const mock = {
    async initialize() {},
    async listKeys() {
      return listKeysMock();
    },
    async updateKey(
      id: string,
      name: string,
      apiKey: string,
      baseUrl: string,
      env: any
    ) {
      return updateKeyMock(id, name, apiKey, baseUrl, env);
    },
    async getKey(id: string) {
      return getKeyMock(id);
    },
    async getKeyMetadata(idOrName: string) {
      const keys = await listKeysMock();
      return keys.find((k) => k.id === idOrName || k.name === idOrName) ?? null;
    },
  };
  return {
    __esModule: true,
    getKeyManager: () => mock,
  };
});

const answers: any[] = [];
const promptMock = jest.fn(async (..._args: any[]) => {
  const answer = answers.shift();
  if (!answer) throw new Error("No more answers in mock queue");
  return answer;
});

jest.mock("inquirer", () => ({
  __esModule: true,
  default: { prompt: promptMock },
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

jest.mock("ora", () => ({
  __esModule: true,
  default: () => ({
    start: () => ({ succeed: () => {}, fail: () => {}, stop: () => {} }),
    stop: () => {},
    succeed: () => {},
    fail: () => {},
  }),
}));

// Mock password prompt
jest.mock("../../src/utils/password-prompt.js", () => ({
  promptForApiKey: jest.fn(async () => "abcdefabcdefabcdefabcdefabcdefab"),
}));

// Mock endpoint prompt
jest.mock("../../src/utils/endpoint-prompt.js", () => ({
  promptForIterableBaseUrl: jest.fn(async () => "https://api.iterable.com"),
}));

// Silence output
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "clear").mockImplementation(() => {});

describe("keys update command", () => {
  const testKey = {
    id: "11111111-2222-3333-4444-555555555555",
    name: "production",
    baseUrl: "https://api.iterable.com",
    created: new Date().toISOString(),
    isActive: true,
    env: {
      ITERABLE_USER_PII: "false",
      ITERABLE_ENABLE_WRITES: "true",
      ITERABLE_ENABLE_SENDS: "false",
    },
  };

  beforeEach(() => {
    updateKeyMock.mockClear();
    getKeyMock.mockClear();
    listKeysMock.mockClear();
    promptMock.mockClear();
    answers.length = 0; // Clear answers queue

    listKeysMock.mockResolvedValue([testKey]);
    updateKeyMock.mockResolvedValue(testKey.id);
    getKeyMock.mockResolvedValue("abcdefabcdefabcdefabcdefabcdefab");
  });

  it("updates existing key without changing API key value", async () => {
    answers.push(
      { updateApiKey: false },
      { name: "production" },
      { activateNow: false }
    );

    const originalArgv = process.argv;
    process.argv = ["node", "cli", "keys", "update", "production"];

    const { handleKeysCommand } = await import("../../src/keys-cli.js");
    await handleKeysCommand();

    expect(updateKeyMock).toHaveBeenCalledWith(
      testKey.id,
      "production",
      "abcdefabcdefabcdefabcdefabcdefab", // existing API key
      "https://api.iterable.com",
      expect.objectContaining({
        ITERABLE_USER_PII: "false",
        ITERABLE_ENABLE_WRITES: "true",
        ITERABLE_ENABLE_SENDS: "false",
      })
    );

    process.argv = originalArgv;
  });

  it("updates key with new API key value", async () => {
    const { promptForApiKey } = await import(
      "../../src/utils/password-prompt.js"
    );
    (promptForApiKey as any).mockResolvedValueOnce(
      "fedcbafedcbafedcbafedcbafedcbafe"
    );

    answers.push(
      { updateApiKey: true },
      { name: "production-updated" },
      { activateNow: false }
    );

    const originalArgv = process.argv;
    process.argv = ["node", "cli", "keys", "update", "production"];

    const { handleKeysCommand } = await import("../../src/keys-cli.js");
    await handleKeysCommand();

    expect(updateKeyMock).toHaveBeenCalledWith(
      testKey.id,
      "production-updated",
      "fedcbafedcbafedcbafedcbafedcbafe", // new API key
      "https://api.iterable.com",
      expect.any(Object)
    );

    process.argv = originalArgv;
  });

  it("updates permissions when user selects advanced", async () => {
    answers.push(
      { updateApiKey: false },
      { name: "production" },
      { permFlags: ["pii", "writes", "sends"] },
      { activateNow: false }
    );

    const originalArgv = process.argv;
    process.argv = [
      "node",
      "cli",
      "keys",
      "update",
      "production",
      "--advanced",
    ];

    const { handleKeysCommand } = await import("../../src/keys-cli.js");
    await handleKeysCommand();

    expect(updateKeyMock).toHaveBeenCalledWith(
      testKey.id,
      "production",
      expect.any(String),
      "https://api.iterable.com",
      expect.objectContaining({
        ITERABLE_USER_PII: "true",
        ITERABLE_ENABLE_WRITES: "true",
        ITERABLE_ENABLE_SENDS: "true",
      })
    );

    process.argv = originalArgv;
  });
});
