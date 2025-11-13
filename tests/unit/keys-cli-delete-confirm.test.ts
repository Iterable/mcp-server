import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const deleteKeyMock = jest.fn();

jest.mock("../../src/key-manager.js", () => {
  const keys = [
    {
      id: "11111111-2222-3333-4444-555555555555",
      name: "to-delete",
      baseUrl: "https://api.iterable.com",
      created: new Date().toISOString(),
      isActive: false,
    },
  ];
  const mock = {
    async initialize() {},
    async listKeys() {
      return keys;
    },
    async deleteKey(id: string) {
      deleteKeyMock(id);
    },
  };
  return {
    __esModule: true,
    getKeyManager: () => mock,
  };
});

jest.mock("inquirer", () => ({
  __esModule: true,
  default: { prompt: jest.fn(async () => ({ confirmDelete: false })) },
}));

// Mock UI module to avoid importing boxen/chalk-heavy ESM in tests
jest.mock("../../src/utils/ui.js", () => ({
  __esModule: true,
  createTable: () => ({ push: () => {}, toString: () => "" }),
  formatKeyValue: (_k: string, v: string) => v,
  icons: { key: "", globe: "" },
  showBox: () => {},
  showError: () => {},
  showInfo: () => {},
  showIterableLogo: () => {},
  showSection: () => {},
  showSuccess: () => {},
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
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "clear").mockImplementation(() => {});

import { handleKeysCommand } from "../../src/keys-cli";

describe("keys delete confirmation", () => {
  beforeEach(() => {
    deleteKeyMock.mockClear();
  });

  it("does not delete when user declines confirmation", async () => {
    const originalArgv = process.argv;
    process.argv = ["node", "cli", "keys", "delete", "to-delete"]; // args.slice(2) => ["keys","delete","to-delete"]
    await handleKeysCommand();
    expect(deleteKeyMock).not.toHaveBeenCalled();
    process.argv = originalArgv;
  });
});
