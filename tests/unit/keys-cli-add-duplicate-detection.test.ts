import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import type { ApiKeyMetadata } from "../../src/key-manager.js";

const addKeyMock =
  jest.fn<
    (
      name: string,
      apiKey: string,
      baseUrl: string,
      env: Record<string, string>
    ) => Promise<string>
  >();
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
const findKeyByValueMock =
  jest.fn<(apiKey: string) => Promise<ApiKeyMetadata | null>>();
const listKeysMock = jest.fn<() => Promise<ApiKeyMetadata[]>>();

jest.mock("../../src/key-manager.js", () => {
  const mock = {
    async initialize() {},
    async listKeys() {
      return listKeysMock();
    },
    async addKey(name: string, apiKey: string, baseUrl: string, env: any) {
      return addKeyMock(name, apiKey, baseUrl, env);
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
    async findKeyByValue(apiKey: string) {
      return findKeyByValueMock(apiKey);
    },
    async getKeyMetadata(idOrName: string) {
      const keys = await listKeysMock();
      return keys.find((k) => k.id === idOrName || k.name === idOrName) ?? null;
    },
    async setActiveKey() {},
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

describe("keys add with duplicate detection", () => {
  const existingKey = {
    id: "existing-id-1234",
    name: "existing-key",
    baseUrl: "https://api.iterable.com",
    created: new Date().toISOString(),
    isActive: false,
    env: {},
  };

  beforeEach(() => {
    addKeyMock.mockClear();
    updateKeyMock.mockClear();
    findKeyByValueMock.mockClear();
    listKeysMock.mockClear();
    promptMock.mockClear();
    answers.length = 0; // Clear answers queue

    listKeysMock.mockResolvedValue([existingKey]);
    addKeyMock.mockResolvedValue("new-key-id");
    updateKeyMock.mockResolvedValue(existingKey.id);
  });

  it("converts add to update when duplicate API key detected and user confirms", async () => {
    // Simulate finding an existing key with the same API key value
    findKeyByValueMock.mockResolvedValue(existingKey);

    // After updating, the updated key should be in the list
    const updatedKey = { ...existingKey, name: "new-name" };
    listKeysMock.mockResolvedValue([updatedKey]);
    updateKeyMock.mockResolvedValue(updatedKey.id);

    answers.push(
      { updateExisting: true },
      { name: "new-name" },
      { activateNow: false }
    );

    const originalArgv = process.argv;
    process.argv = ["node", "cli", "keys", "add"];

    const { handleKeysCommand } = await import("../../src/keys-cli.js");
    await handleKeysCommand();

    // Should NOT call addKey
    expect(addKeyMock).not.toHaveBeenCalled();

    // Should call updateKey instead
    expect(updateKeyMock).toHaveBeenCalledWith(
      existingKey.id,
      "new-name",
      "abcdefabcdefabcdefabcdefabcdefab",
      "https://api.iterable.com",
      expect.any(Object)
    );

    process.argv = originalArgv;
  });

  it("cancels and returns existing key ID when user declines update", async () => {
    findKeyByValueMock.mockResolvedValue(existingKey);

    answers.push({ updateExisting: false }, { activateNow: false });

    const originalArgv = process.argv;
    process.argv = ["node", "cli", "keys", "add"];

    const { handleKeysCommand } = await import("../../src/keys-cli.js");
    await handleKeysCommand();

    // Should NOT call addKey or updateKey
    expect(addKeyMock).not.toHaveBeenCalled();
    expect(updateKeyMock).not.toHaveBeenCalled();

    process.argv = originalArgv;
  });

  it("proceeds with add when no duplicate API key found", async () => {
    // No existing key found with this API key value
    findKeyByValueMock.mockResolvedValue(null);

    // After adding, the new key should be in the list
    const newKey = {
      id: "new-key-id",
      name: "brand-new-key",
      baseUrl: "https://api.iterable.com",
      created: new Date().toISOString(),
      isActive: false,
      env: {},
    };
    listKeysMock.mockResolvedValue([existingKey, newKey]);
    addKeyMock.mockResolvedValue(newKey.id);

    answers.push({ name: "brand-new-key" }, { activateNow: false });

    const originalArgv = process.argv;
    process.argv = ["node", "cli", "keys", "add"];

    const { handleKeysCommand } = await import("../../src/keys-cli.js");
    await handleKeysCommand();

    // Should call addKey
    expect(addKeyMock).toHaveBeenCalledWith(
      "brand-new-key",
      "abcdefabcdefabcdefabcdefabcdefab",
      "https://api.iterable.com",
      expect.any(Object)
    );

    // Should NOT call updateKey
    expect(updateKeyMock).not.toHaveBeenCalled();

    process.argv = originalArgv;
  });
});
