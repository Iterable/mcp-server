/* eslint-disable no-console */

import { execFile, spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import inquirer from "inquirer";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

import { getKeyManager } from "./key-manager.js";
import { getKeyStorageMessage } from "./utils/formatting.js";

const { dirname, join } = path;

// IMPORTANT: UI imports are loaded lazily inside functions to avoid ESM issues in Jest/CommonJS.

// Executable/package names
const LOCAL_BINARY_NAME = "iterable-mcp";
const NPX_PACKAGE_NAME = "@iterable/mcp";

// Tool display names
const TOOL_NAMES = {
  cursor: "Cursor",
  "claude-desktop": "Claude Desktop",
  "claude-code": "Claude Code",
  manual: "Manual Setup",
} as const;

// Get package version
const packageJson = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
    "utf-8"
  )
) as { version: string };

const TOOL_CONFIGS = {
  "claude-desktop": (() => {
    switch (process.platform) {
      case "darwin":
        return path.join(
          os.homedir(),
          "Library",
          "Application Support",
          "Claude",
          "claude_desktop_config.json"
        );
      case "win32":
        return path.join(
          process.env.APPDATA || "",
          "Claude",
          "claude_desktop_config.json"
        );
      default:
        return path.join(
          process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
          "Claude",
          "claude_desktop_config.json"
        );
    }
  })(),
  cursor: path.join(os.homedir(), ".cursor", "mcp.json"),
} as const;

const execFileAsync = promisify(execFile);

// Cross-platform command finder
// Uses execFile to prevent shell injection vulnerabilities
// Exported for testing
export const findCommand = async (command: string): Promise<string> => {
  const finder = process.platform === "win32" ? "where" : "which";

  try {
    const { stdout } = await execFileAsync(finder, [command]);
    const lines = stdout.trim().split("\n");
    if (!lines?.[0]) {
      throw new Error(`${command} not found`);
    }
    return lines[0]!;
  } catch (_error) {
    throw new Error(`${command} not found`);
  }
};

// Auto-detect if running from a local development build
const isLocalDevelopmentBuild = (): boolean => {
  const scriptPath = process.argv[1] || "";
  if (scriptPath.includes("/dist/index.js")) {
    return true;
  }

  try {
    const distPath = path.resolve(process.cwd(), "dist", "index.js");
    return existsSync(distPath);
  } catch {
    return false;
  }
};

// Build MCP config - exported for testing
export const buildMcpConfig = (options: {
  isLocal?: boolean;
  env: Record<string, string>;
  nodePath?: string;
  npxPath?: string;
  autoUpdate?: boolean;
}) => {
  const isLocal = options.isLocal ?? isLocalDevelopmentBuild();
  const nodePath =
    options.nodePath || process.env.ITERABLE_MCP_NODE_PATH || "node";
  const npxPath = options.npxPath || process.env.ITERABLE_MCP_NPX_PATH || "npx";
  const packageName = NPX_PACKAGE_NAME + (options.autoUpdate ? "@latest" : "");

  return {
    type: "stdio" as const,
    command: isLocal ? nodePath : npxPath,
    args: isLocal
      ? [path.resolve(process.cwd(), "dist", "index.js")]
      : ["-y", packageName],
    env: options.env,
  };
};

/**
 * Merge selected env flags with key metadata env (if provided), preferring the key's
 * persisted values. This ensures the written MCP configs reflect the authoritative
 * values saved to the key after any updates in the setup flow.
 */
export function resolveFinalMcpEnv(
  selectedEnv: Record<string, string>,
  keyEnv?: Record<string, string>
): Record<string, string> {
  const normalize = (v?: string) => (v === "true" ? "true" : "false");
  const result = { ...selectedEnv } as Record<string, string>;
  if (keyEnv) {
    result.ITERABLE_USER_PII = normalize(
      keyEnv.ITERABLE_USER_PII ?? result.ITERABLE_USER_PII
    );
    result.ITERABLE_ENABLE_WRITES = normalize(
      keyEnv.ITERABLE_ENABLE_WRITES ?? result.ITERABLE_ENABLE_WRITES
    );
    result.ITERABLE_ENABLE_SENDS = normalize(
      keyEnv.ITERABLE_ENABLE_SENDS ?? result.ITERABLE_ENABLE_SENDS
    );
  }
  result.ITERABLE_USER_PII = normalize(result.ITERABLE_USER_PII);
  result.ITERABLE_ENABLE_WRITES = normalize(result.ITERABLE_ENABLE_WRITES);
  result.ITERABLE_ENABLE_SENDS = normalize(result.ITERABLE_ENABLE_SENDS);
  return result;
}

/**
 * Pick only permission-related env flags for persistence into key metadata.
 */
export function pickPersistablePermissionEnv(env: Record<string, string>): {
  ITERABLE_USER_PII: "true" | "false";
  ITERABLE_ENABLE_WRITES: "true" | "false";
  ITERABLE_ENABLE_SENDS: "true" | "false";
} {
  const normalize = (v?: string) => (v === "true" ? "true" : "false");
  return {
    ITERABLE_USER_PII: normalize(env.ITERABLE_USER_PII) as "true" | "false",
    ITERABLE_ENABLE_WRITES: normalize(env.ITERABLE_ENABLE_WRITES) as
      | "true"
      | "false",
    ITERABLE_ENABLE_SENDS: normalize(env.ITERABLE_ENABLE_SENDS) as
      | "true"
      | "false",
  };
}

/**
 * Remove permission flags from env (they're loaded from key manager)
 * Returns only non-persisted env vars like debug flags
 */
export function omitPersistablePermissionEnv(
  env: Record<string, string>
): Record<string, string> {
  const {
    ITERABLE_USER_PII: _pii,
    ITERABLE_ENABLE_WRITES: _writes,
    ITERABLE_ENABLE_SENDS: _sends,
    ...rest
  } = env;
  return rest;
}

/**
 * Enforce that Sends require Writes. If Sends is enabled but Writes is disabled,
 * disable Sends and optionally emit a warning.
 */
export function enforceSendsRequiresWrites(
  env: Record<string, string>,
  warn?: (msg: string) => void
): Record<string, string> {
  if (
    env.ITERABLE_ENABLE_SENDS === "true" &&
    env.ITERABLE_ENABLE_WRITES !== "true"
  ) {
    env.ITERABLE_ENABLE_SENDS = "false";
    if (warn) warn("Sends require Writes. Disabling Sends.");
  }
  return env;
}

/**
 * Security defaults used for Privacy & Security prompts.
 * Always conservative: all disabled by default.
 */
export function getSecurityDefaults(_activeMeta?: unknown): {
  defaultPii: boolean;
  defaultWrites: boolean;
  defaultSends: boolean;
} {
  return { defaultPii: false, defaultWrites: false, defaultSends: false };
}

export const setupMcpServer = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const showHelp = args.includes("--help") || args.includes("-h");
  const advanced = args.includes("--advanced");
  const autoUpdate = args.includes("--auto-update");
  let tools = [
    ...(args.includes("--claude-desktop") ? ["claude-desktop" as const] : []),
    ...(args.includes("--cursor") ? ["cursor" as const] : []),
    ...(args.includes("--claude-code") ? ["claude-code" as const] : []),
    ...(args.includes("--manual") ? ["manual" as const] : []),
  ];

  // Detect how the command was invoked
  const isNpx =
    process.argv[1]?.includes("npx") ||
    process.env.npm_execpath?.includes("npx");
  const commandName = isNpx ? `npx ${NPX_PACKAGE_NAME}` : LOCAL_BINARY_NAME;

  if (showHelp) {
    const { createTable, icons, showBox, showIterableLogo, showSection } =
      await import("./utils/ui.js");
    const chalk = (await import("chalk")).default;
    console.clear();
    showIterableLogo(packageJson.version);

    showSection("Setup Commands", icons.rocket);
    console.log();

    const setupTable = createTable({
      head: ["Command", "Description"],
      colWidths: [45, 40],
      style: "normal",
    });

    setupTable.push(
      [`${commandName} setup --claude-desktop`, "Configure for Claude Desktop"],
      [`${commandName} setup --cursor`, "Configure for Cursor"],
      [`${commandName} setup --claude-code`, "Configure for Claude Code"],
      [`${commandName} setup --manual`, "Show manual config instructions"],
      [
        `${commandName} setup --cursor --claude-desktop`,
        "Configure multiple tools",
      ],
      [`${commandName} setup --cursor --debug`, "Enable debug logging"],
      [
        `${commandName} setup --cursor --auto-update`,
        "Always use latest version",
      ]
    );

    console.log(setupTable.toString());
    console.log();
    console.log();

    showSection("Key Management", icons.key);
    console.log();

    const keysTable = createTable({
      head: ["Command", "Description"],
      colWidths: [45, 40],
      style: "normal",
    });

    keysTable.push(
      [`${commandName} keys list`, "View all stored API keys"],
      [`${commandName} keys add`, "Add a new API key"],
      [`${commandName} keys activate <name>`, "Switch to a different key"],
      [`${commandName} keys delete <id>`, "Remove a key by ID"]
    );

    console.log(keysTable.toString());
    console.log();
    console.log();

    showSection("Environment Variables", icons.globe);
    console.log();

    const envTable = createTable({
      head: ["Variable", "Description"],
      colWidths: [30, 50],
      style: "compact",
    });

    envTable.push(
      ["ITERABLE_API_KEY", chalk.gray("Your Iterable API key")],
      [
        "ITERABLE_BASE_URL",
        chalk.gray("API endpoint (default: api.iterable.com)"),
      ],
      [
        "ITERABLE_USER_PII",
        chalk.gray("Enable user PII access (default: false)"),
      ],
      [
        "ITERABLE_ENABLE_WRITES",
        chalk.gray("Enable write operations (default: false)"),
      ],
      [
        "ITERABLE_ENABLE_SENDS",
        chalk.gray("Enable message sending (default: false)"),
      ],
      ["ITERABLE_MCP_NODE_PATH", chalk.gray("Custom node executable path")],
      ["ITERABLE_MCP_NPX_PATH", chalk.gray("Custom npx executable path")]
    );

    console.log(envTable.toString());
    console.log();

    showBox(
      "Quick Start",
      [
        chalk.white.bold("1. Run setup for your AI tool:"),
        chalk.cyan(`   ${commandName} setup --cursor`),
        "",
        chalk.white.bold("2. Restart your AI tool"),
        "",
        chalk.white.bold("3. Start building!"),
        chalk.gray("   Try: 'list my Iterable campaigns'"),
      ],
      { icon: icons.zap, theme: "success" }
    );

    showBox(
      "Security Features",
      [
        "• API keys prompted interactively (never in shell history)",
        getKeyStorageMessage(true),
        "• Each key coupled to its endpoint (US/EU/custom)",
      ],
      { icon: icons.lock, theme: "info", padding: 1 }
    );

    return;
  }

  // New behavior: if no tools were provided as flags, prompt user to select one or more
  if (tools.length === 0) {
    // Show logo first when no flags provided
    const { showIterableLogo } = await import("./utils/ui.js");
    console.clear();
    showIterableLogo(packageJson.version);

    const { selectedTools } = await inquirer.prompt<{
      selectedTools: Array<
        "cursor" | "claude-desktop" | "claude-code" | "manual"
      >;
    }>([
      {
        type: "checkbox",
        name: "selectedTools",
        message: "Select your AI tools to configure:",
        choices: [
          { name: "Cursor", value: "cursor" },
          { name: "Claude Desktop", value: "claude-desktop" },
          { name: "Claude Code (CLI)", value: "claude-code" },
          { name: "Other / Manual Setup", value: "manual" },
        ],
        validate: (arr: any) =>
          Array.isArray(arr) && arr.length > 0
            ? true
            : "Please select at least one tool",
      } as any,
    ]);
    tools = selectedTools;
  }

  // Start the setup flow
  console.clear();
  const {
    formatKeyValue,
    icons,
    showCompletion,
    showError,
    showInfo,
    showIterableLogo,
    showSection,
    showSuccess,
    showWarning,
    linkColor,
    valueColor,
  } = await import("./utils/ui.js");
  const chalk = (await import("chalk")).default;
  showIterableLogo(packageJson.version);
  // Succinct overview of what will be configured
  console.log(
    chalk.gray(
      `Running setup to configure: ${tools.map((t) => TOOL_NAMES[t]).join(", ")}`
    )
  );
  console.log();
  const ora = (await import("ora")).default;
  const spinner = ora();

  try {
    // Step 1: API Key Configuration
    console.log();
    showSection("API Key Configuration", icons.key);
    console.log();

    let apiKey: string | undefined;
    let keyName: string;
    let baseUrl: string | undefined;

    let usedKeyName: string | undefined;
    let usedExistingKey = false;
    let selectedExistingMeta: any | undefined;

    // 1) Offer using API key from environment
    if (process.env.ITERABLE_API_KEY) {
      const { useEnvKey } = await inquirer.prompt([
        {
          type: "confirm",
          name: "useEnvKey",
          message:
            "Found API key in ITERABLE_API_KEY environment variable. Import and use this key?",
          default: true,
        },
      ]);
      if (useEnvKey) {
        apiKey = process.env.ITERABLE_API_KEY;
        showSuccess("Using API key from environment variable");
      }
    }

    // 2) If not using env key, offer using an existing stored key
    if (!apiKey) {
      const km = getKeyManager();
      const keys = await km.listKeys().catch(() => [] as any[]);
      if (Array.isArray(keys) && keys.length > 0) {
        const { useExisting } = await inquirer.prompt([
          {
            type: "confirm",
            name: "useExisting",
            message: `Found ${keys.length} existing Iterable API key${keys.length === 1 ? "" : "s"} in key storage. Use one of these?`,
            default: true,
          },
        ]);
        if (useExisting) {
          const { formatKeychainChoiceLabel } = await import("./utils/ui.js");
          const { chosenId } = await inquirer.prompt([
            {
              type: "list",
              name: "chosenId",
              message: "Select a stored key:",
              choices: keys.map((k: any) => ({
                name: formatKeychainChoiceLabel(
                  k.name,
                  k.baseUrl,
                  k.isActive,
                  k.env
                ),
                value: k.id,
                short: k.name,
              })),
              pageSize: Math.min(10, keys.length),
            },
          ]);

          try {
            const meta = keys.find((k: any) => k.id === chosenId);
            if (!meta) throw new Error("Selected key metadata not found");
            baseUrl = meta.baseUrl;
            usedKeyName = meta.name;
            usedExistingKey = true;
            selectedExistingMeta = meta;
            showSuccess(`Using existing key "${meta.name}"`);
          } catch (e) {
            showError(
              e instanceof Error
                ? e.message
                : "Failed to load selected key from storage"
            );
            process.exit(1);
          }
        }
      }
    }

    // 3) If neither env nor existing key chosen, prompt for a new key
    if (!apiKey && !usedExistingKey) {
      const { newApiKey } = await inquirer.prompt([
        {
          type: "password",
          name: "newApiKey",
          message: "Enter your Iterable API key:",
          validate: (input: string) => {
            if (!input) return "API key is required";
            if (!/^[a-f0-9]{32}$/.test(input))
              return "API key must be a 32-character lowercase hexadecimal string";
            return true;
          },
          mask: "*",
        },
      ]);
      apiKey = newApiKey;
    }

    // Step 2: API Endpoint Selection
    console.log();
    showSection("API Endpoint Configuration", icons.globe);
    console.log();

    if (!baseUrl) {
      if (process.env.ITERABLE_BASE_URL) {
        baseUrl = process.env.ITERABLE_BASE_URL;
        showSuccess(`Using API endpoint from environment: ${baseUrl}`);
      } else {
        const { promptForIterableBaseUrl } = await import(
          "./utils/endpoint-prompt.js"
        );
        try {
          baseUrl = await promptForIterableBaseUrl({
            inquirer,
            icons,
            chalk,
            showError,
          });
        } catch {
          process.exit(1);
        }
      }
    } else {
      showSuccess(`Using API endpoint from selected key: ${baseUrl}`);
    }

    console.log();
    console.log(
      formatKeyValue("Selected endpoint", baseUrl as string, linkColor())
    );
    console.log();

    // Step 3: Store the key securely
    let existingKeyWithValue: any = null;
    const keyManager = getKeyManager();

    spinner.start("Initializing secure key storage...");
    await keyManager.initialize();
    spinner.succeed("Key storage ready");

    // Check if key already exists
    if (!usedExistingKey && apiKey) {
      spinner.start("Checking for existing keys...");
      existingKeyWithValue = await keyManager.findKeyByValue(apiKey as string);
      spinner.stop();
    }

    if (usedExistingKey) {
      // Offer to activate the selected existing key if not already active
      if (!selectedExistingMeta?.isActive) {
        const { activateExisting } = await inquirer.prompt([
          {
            type: "confirm",
            name: "activateExisting",
            message: `Set "${selectedExistingMeta?.name}" as your active API key?`,
            default: true,
          },
        ]);
        if (activateExisting) {
          await keyManager.setActiveKey(selectedExistingMeta!.id);
          showSuccess(`"${selectedExistingMeta?.name}" is now your active key`);
        } else {
          showInfo("Keeping your current active key");
        }
      } else {
        showSuccess(
          `"${selectedExistingMeta?.name}" is already your active key`
        );
      }
    } else if (existingKeyWithValue) {
      showInfo(
        `This API key is already stored as "${existingKeyWithValue.name}"`
      );
      usedKeyName = existingKeyWithValue.name;

      if (!existingKeyWithValue.isActive) {
        const { activateExisting } = await inquirer.prompt([
          {
            type: "confirm",
            name: "activateExisting",
            message: `Set "${existingKeyWithValue.name}" as your active API key?`,
            default: true,
          },
        ]);

        if (activateExisting) {
          await keyManager.setActiveKey(existingKeyWithValue.id);
          showSuccess(`"${existingKeyWithValue.name}" is now your active key`);
        } else {
          showInfo("Keeping your current active key");
        }
      } else {
        showSuccess(
          `"${existingKeyWithValue.name}" is already your active key`
        );
      }
    } else {
      // New key - prompt for name
      const { newKeyName } = await inquirer.prompt([
        {
          type: "input",
          name: "newKeyName",
          message: "Enter a name for this API key:",
          default: "default",
          validate: (input: string) => {
            if (input && input.length > 50)
              return "Key name must be 50 characters or less";
            return true;
          },
        },
      ]);

      keyName = newKeyName || "default";

      spinner.start("Storing API key securely...");
      try {
        const newKeyId = await keyManager.addKey(
          keyName,
          apiKey as string,
          baseUrl as string
        );
        spinner.succeed("API key stored successfully!");

        console.log();
        console.log(formatKeyValue("Name", keyName, chalk.white.bold));
        console.log(formatKeyValue("ID", newKeyId, chalk.gray));
        console.log(formatKeyValue("Endpoint", baseUrl as string, chalk.cyan));
        console.log();
        usedKeyName = keyName;

        // Check if we should activate this key
        const allKeys = await keyManager.listKeys();
        if (allKeys.length > 1) {
          const { activateNew } = await inquirer.prompt([
            {
              type: "confirm",
              name: "activateNew",
              message: `Set "${keyName}" as your active API key?`,
              default: true,
            },
          ]);

          if (activateNew) {
            await keyManager.setActiveKey(newKeyId);
            showSuccess(`"${keyName}" is now your active key`);
          } else {
            showInfo(
              `Keeping your current active key. Run 'iterable-mcp keys activate "${keyName}"' to switch later.`
            );
          }
        }
      } catch (error) {
        const { sanitizeString } = await import("./utils/sanitize.js");
        spinner.fail("Failed to store API key");
        console.log();
        const msg =
          error instanceof Error
            ? sanitizeString(error.message)
            : "Unknown error";
        showError(msg);
        console.log();
        showInfo(
          "Your API key was not stored. You can re-run 'iterable-mcp setup' to try again."
        );
        showInfo(
          "If the problem persists, verify storage access and disk permissions."
        );
        process.exit(1);
      }
    }

    // Step 4: Privacy & Security Settings (Basic by default; Advanced via --advanced)
    console.log();
    showSection("Privacy & Security Settings", icons.lock);
    console.log();

    // Default conservative env flags
    let selectedEnv: {
      ITERABLE_USER_PII: "true" | "false";
      ITERABLE_ENABLE_WRITES: "true" | "false";
      ITERABLE_ENABLE_SENDS: "true" | "false";
    } = {
      ITERABLE_USER_PII: "false",
      ITERABLE_ENABLE_WRITES: "false",
      ITERABLE_ENABLE_SENDS: "false",
    };

    if (advanced) {
      const { permFlags } = await inquirer.prompt([
        {
          type: "checkbox",
          name: "permFlags",
          message: "Select permissions to enable (default: none):",
          choices: [
            { name: "View PII (access user data)", value: "pii" },
            {
              name: "Write operations (create/update/delete)",
              value: "writes",
            },
            { name: "Sends (campaigns/journeys/events)", value: "sends" },
          ],
          pageSize: 6,
          default: [],
        },
      ] as any);
      selectedEnv = {
        ITERABLE_USER_PII: (permFlags as string[]).includes("pii")
          ? "true"
          : "false",
        ITERABLE_ENABLE_WRITES: (permFlags as string[]).includes("writes")
          ? "true"
          : "false",
        ITERABLE_ENABLE_SENDS: (permFlags as string[]).includes("sends")
          ? "true"
          : "false",
      };
    }

    let mcpEnv: Record<string, string> = {
      ITERABLE_USER_PII: selectedEnv.ITERABLE_USER_PII,
      ITERABLE_ENABLE_WRITES: selectedEnv.ITERABLE_ENABLE_WRITES,
      ITERABLE_ENABLE_SENDS: selectedEnv.ITERABLE_ENABLE_SENDS,
    };
    if (args.includes("--debug")) {
      mcpEnv.ITERABLE_DEBUG = "true";
      mcpEnv.LOG_LEVEL = "debug";
    }
    // Enforce permission invariants before displaying
    mcpEnv = enforceSendsRequiresWrites(mcpEnv, (msg) => showWarning(msg));

    console.log();
    console.log(
      formatKeyValue(
        "User PII Access",
        mcpEnv.ITERABLE_USER_PII === "true"
          ? chalk.green("Enabled")
          : chalk.gray("Disabled")
      )
    );
    console.log(
      formatKeyValue(
        "Write Operations",
        mcpEnv.ITERABLE_ENABLE_WRITES === "true"
          ? chalk.green("Enabled")
          : chalk.gray("Disabled")
      )
    );
    console.log(
      formatKeyValue(
        "Sends",
        mcpEnv.ITERABLE_ENABLE_SENDS === "true"
          ? chalk.green("Enabled")
          : chalk.gray("Disabled")
      )
    );
    // Only show the default note when all flags are disabled
    if (
      mcpEnv.ITERABLE_USER_PII !== "true" &&
      mcpEnv.ITERABLE_ENABLE_WRITES !== "true" &&
      mcpEnv.ITERABLE_ENABLE_SENDS !== "true"
    ) {
      console.log();
      console.log(
        chalk.gray(
          "Note: These are disabled by default. If you absolutely need to enable these, run 'iterable-mcp setup --advanced'"
        )
      );
    } else {
      console.log();
      showWarning(
        "Warning: Elevated capabilities enabled. Sends, writes, and/or PII access may now occur."
      );
    }
    console.log();

    // If we used an existing key, update its env overrides with chosen settings
    if (usedKeyName) {
      try {
        await keyManager.updateKeyEnv(
          usedKeyName,
          pickPersistablePermissionEnv(mcpEnv)
        );

        // Re-read the key metadata and prefer its persisted env when writing
        // tool configurations. This addresses cases where the key was activated
        // during setup and ensures configs reflect the updated values.
        const keys = await keyManager.listKeys();
        const updatedMeta = keys.find(
          (k) => k.name === usedKeyName || k.id === usedKeyName
        );
        if (updatedMeta?.env) {
          mcpEnv = resolveFinalMcpEnv(mcpEnv, updatedMeta.env);
        }
      } catch (err) {
        if (process.env.ITERABLE_DEBUG === "true") {
          console.warn(
            "Non-fatal: failed to persist per-key env settings",
            err
          );
        }
      }
    }
    // Enforce again after merging persisted key env
    mcpEnv = enforceSendsRequiresWrites(mcpEnv, (msg) => showWarning(msg));

    // Step 5: Configure AI Tools
    console.log();
    showSection("Configuring AI Tools", icons.zap);
    console.log();

    // Ask about auto-update unless flag was provided
    let useAutoUpdate = autoUpdate;
    if (!autoUpdate) {
      const { enableAutoUpdate } = await inquirer.prompt([
        {
          type: "confirm",
          name: "enableAutoUpdate",
          message:
            "Always use the latest version? (Checks for updates on each restart)",
          default: false,
        },
      ]);
      useAutoUpdate = enableAutoUpdate;
    }

    const iterableMcpConfig = buildMcpConfig({
      ...(args.includes("--local") && { isLocal: true }),
      env: omitPersistablePermissionEnv(mcpEnv),
      autoUpdate: useAutoUpdate,
    });

    // Preflight confirmation summary before applying changes
    console.log(chalk.gray("Summary:"));
    console.log(
      formatKeyValue(
        "Tools",
        tools.map((t) => TOOL_NAMES[t]).join(", "),
        valueColor()
      )
    );
    if (usedKeyName) {
      console.log(formatKeyValue("API Key", usedKeyName, valueColor()));
    }
    console.log(formatKeyValue("Endpoint", baseUrl as string, valueColor()));
    console.log(
      formatKeyValue(
        "User PII",
        mcpEnv.ITERABLE_USER_PII === "true"
          ? chalk.green("Enabled")
          : chalk.gray("Disabled")
      )
    );
    console.log(
      formatKeyValue(
        "Writes",
        mcpEnv.ITERABLE_ENABLE_WRITES === "true"
          ? chalk.green("Enabled")
          : chalk.gray("Disabled")
      )
    );
    console.log(
      formatKeyValue(
        "Sends",
        mcpEnv.ITERABLE_ENABLE_SENDS === "true"
          ? chalk.green("Enabled")
          : chalk.gray("Disabled")
      )
    );
    console.log();
    const { proceed } = await inquirer.prompt<{ proceed: boolean }>([
      {
        type: "confirm",
        name: "proceed",
        message: "Proceed with configuration?",
        default: true,
      },
    ]);
    if (!proceed) {
      showInfo("Setup cancelled by user. No changes were made.");
      return;
    }

    const fileBasedTools = tools.filter(
      (tool) => tool === "claude-desktop" || tool === "cursor"
    ) as Array<"claude-desktop" | "cursor">;
    const needsClaudeCode = tools.includes("claude-code");
    const needsManual = tools.includes("manual");

    if (fileBasedTools.length > 0) {
      const { updateToolConfig } = await import("./utils/tool-config.js");
      for (const tool of fileBasedTools) {
        const configPath = TOOL_CONFIGS[tool];
        const toolName =
          tool === "claude-desktop" ? "Claude Desktop" : "Cursor";
        spinner.start(`Configuring ${toolName}...`);
        try {
          await updateToolConfig(configPath, iterableMcpConfig);
          spinner.succeed(`${toolName} configured successfully`);
        } catch (error) {
          spinner.fail(`Failed to configure ${toolName}`);
          throw error;
        }
      }
    }

    if (needsClaudeCode) {
      spinner.start("Checking for Claude CLI...");

      try {
        await findCommand("claude");
        spinner.succeed("Claude CLI found");
      } catch {
        spinner.fail("Claude CLI not found");
        showError(
          "Please install Claude Code first: https://docs.claude.com/en/docs/claude-code/overview"
        );
        console.log();
        showInfo("After installing, re-run: iterable-mcp setup --claude-code");
        process.exit(1);
      }

      const configJson = JSON.stringify(iterableMcpConfig);

      // Remove existing config (ignore errors)
      await execFileAsync("claude", ["mcp", "remove", "iterable"]).catch(
        () => {}
      );

      spinner.start("Configuring Claude Code...");

      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          "claude",
          ["mcp", "add-json", "iterable", configJson],
          {
            stdio: "inherit",
          }
        );

        child.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(
              new Error(
                `claude mcp add-json exited with code ${code ?? "unknown"}`
              )
            );
          }
        });

        child.on("error", reject);
      });

      spinner.succeed("Claude Code configured successfully");
    }

    if (needsManual) {
      console.log();
      showSection("Manual Configuration", icons.rocket);
      console.log();

      const { type, command, args, env } = iterableMcpConfig;

      showInfo("Your API key has been stored.");
      showInfo("Add the MCP server to your AI tool with these settings:");
      console.log();
      console.log(chalk.white.bold("  Type:") + `     ${type}`);
      console.log(chalk.white.bold("  Command:") + `  ${command}`);
      console.log(chalk.white.bold("  Args:") + `     ${args.join(" ")}`);
      const envEntries = Object.entries(env);
      if (envEntries.length > 0) {
        console.log(chalk.white.bold("  Env:"));
        envEntries.forEach(([k, v]) => {
          console.log(chalk.gray(`    ${k}=${v}`));
        });
      }
      console.log();

      showInfo(
        "Refer to your AI tool's documentation for configuration instructions."
      );
    }

    // Build configured tools list
    const configuredTools: string[] = [];
    if (fileBasedTools.includes("cursor")) configuredTools.push("Cursor");
    if (fileBasedTools.includes("claude-desktop"))
      configuredTools.push("Claude Desktop");
    if (needsClaudeCode) configuredTools.push("Claude Code");
    if (needsManual) configuredTools.push("your AI tool");

    const toolsList =
      configuredTools.length === 1
        ? configuredTools[0]
        : configuredTools.length === 2
          ? `${configuredTools[0]} and ${configuredTools[1]}`
          : configuredTools.slice(0, -1).join(", ") +
            ", and " +
            configuredTools[configuredTools.length - 1];

    // Success!
    console.log();
    const nextSteps = [
      ...(needsManual ? ["Configure your AI tool as described above"] : []),
      `Restart ${toolsList} to load the new configuration`,
      "Start using Iterable MCP tools in your conversations",
      ...(needsClaudeCode
        ? ["Run 'claude mcp list' to verify your setup"]
        : []),
    ];

    const tips = [
      `Try: 'list my Iterable campaigns' in ${toolsList}`,
      "Manage keys with 'iterable-mcp keys list'",
      "Switch keys with 'iterable-mcp keys activate <name>'",
    ];

    showCompletion("Setup Complete!", nextSteps, tips);
  } catch (error) {
    spinner.stop();
    showError(error instanceof Error ? error.message : "Setup failed");
    process.exit(1);
  }
};
