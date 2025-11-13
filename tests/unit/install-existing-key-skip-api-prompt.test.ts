import { describe, expect, it, jest } from "@jest/globals";

// Only run this test meaningfully on macOS, since setup flow uses Keychain prompts on darwin
const isDarwin = process.platform === "darwin";

describe("setup skips API key prompt when existing key selected", () => {
  it("does not ask for new API key after choosing existing key", async () => {
    if (!isDarwin) {
      // On non-macOS environments, the Keychain branch won't run; skip
      return;
    }

    // Mock inquirer to provide a deterministic series of answers
    const answers = [
      // When no flags: select tools
      { selectedTools: ["cursor"] },
      // macOS: ask to use existing
      { useExisting: true },
      // choose stored key
      { chosenId: "id-1" },
      // offer to activate selected existing key
      { activateExisting: false },
      // auto-update prompt
      { enableAutoUpdate: false },
      // summary proceed confirm
      { proceed: false },
    ];

    const promptMock = jest.fn(async (..._args: any[]) => answers.shift());

    jest.resetModules();
    jest.mock("inquirer", () => ({
      __esModule: true,
      default: { prompt: promptMock },
      prompt: promptMock,
    }));

    // Mock KeyManager to avoid actual Keychain usage
    jest.mock("../../src/key-manager.js", () => ({
      __esModule: true,
      getKeyManager: () => ({
        initialize: jest.fn(async () => {}),
        listKeys: jest.fn(async () => [
          {
            id: "id-1",
            name: "testingouthiskey",
            baseUrl: "https://api.iterable.com",
            isActive: false,
            env: {},
          },
        ]),
        setActiveKey: jest.fn(async () => {}),
        updateKeyEnv: jest.fn(async () => {}),
        findKeyByValue: jest.fn(async () => null),
      }),
    }));

    // No-op UI to keep output minimal
    jest.mock("../../src/utils/ui.js", () => ({
      __esModule: true,
      showIterableLogo: () => {},
      showSection: () => {},
      showSuccess: () => {},
      showInfo: () => {},
      showWarning: () => {},
      showError: () => {},
      showCompletion: () => {},
      formatKeyValue: (_k: string, v: string) => v,
      icons: { key: "", globe: "", zap: "" },
      createTable: () => ({ push: () => {}, toString: () => "" }),
      formatKeychainChoiceLabel: (
        name: string,
        endpoint: string,
        isActive: boolean
      ) => `${isActive ? "[ACTIVE] " : "  "}${name} ${endpoint}`,
    }));

    // Mock ora spinner
    jest.mock("ora", () => ({
      __esModule: true,
      default: () => ({
        start: () => {},
        stop: () => {},
        succeed: () => {},
        fail: () => {},
      }),
    }));
    // Mock chalk
    jest.mock("chalk", () => ({
      __esModule: true,
      default: new Proxy(() => {}, {
        get: () => (s: any) => String(s),
        apply: (_t, _a, args) => String(args[0]),
      }),
    }));

    const { setupMcpServer } = await import("../../src/install.js");

    await setupMcpServer();

    // Assert that no password prompt for new API key occurred
    const hadPassword = promptMock.mock.calls.some((call) => {
      const arg = call[0];
      const questions = Array.isArray(arg) ? arg : [arg];
      return questions.some(
        (q: any) =>
          q &&
          q.type === "password" &&
          /Enter your Iterable API key/i.test(String(q.message))
      );
    });
    expect(hadPassword).toBe(false);
  }, 30000);
});
