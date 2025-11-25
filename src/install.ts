/* eslint-disable no-console */

import { execFile, spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import inquirer from "inquirer";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

import { type ApiKeyMetadata, getKeyManager } from "./key-manager.js";
import { displayKeyDetails, saveKeyInteractive } from "./keys-cli.js";
import {
  COMMAND_NAME,
  KEYS_COMMAND_TABLE,
  NPX_PACKAGE_NAME,
} from "./utils/command-info.js";
import { getKeyStorageMessage } from "./utils/formatting.js";

const { dirname, join } = path;

// IMPORTANT: UI imports are loaded lazily inside functions to avoid ESM issues in Jest/CommonJS.

// Get package version
const packageJson = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
    "utf-8"
  )
) as { version: string };

// Tool display names
type ToolName = keyof typeof TOOL_NAMES;
const TOOL_NAMES = {
  cursor: "Cursor",
  "claude-desktop": "Claude Desktop",
  "claude-code": "Claude Code",
  "gemini-cli": "Gemini CLI",
  manual: "Manual Setup",
} as const;

type FileBasedToolName = keyof typeof TOOL_CONFIGS;
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
  "gemini-cli": path.join(os.homedir(), ".gemini", "settings.json"),
} as const satisfies Record<string, string>;

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
  let tools: ToolName[] = [
    ...(args.includes("--claude-desktop") ? ["claude-desktop" as const] : []),
    ...(args.includes("--cursor") ? ["cursor" as const] : []),
    ...(args.includes("--claude-code") ? ["claude-code" as const] : []),
    ...(args.includes("--gemini-cli") ? ["gemini-cli" as const] : []),
    ...(args.includes("--manual") ? ["manual" as const] : []),
  ];

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
      [
        `${COMMAND_NAME} setup --claude-desktop`,
        "Configure for Claude Desktop",
      ],
      [`${COMMAND_NAME} setup --cursor`, "Configure for Cursor"],
      [`${COMMAND_NAME} setup --claude-code`, "Configure for Claude Code"],
      [`${COMMAND_NAME} setup --gemini-cli`, "Configure for Gemini CLI"],
      [`${COMMAND_NAME} setup --manual`, "Show manual config instructions"],
      [
        `${COMMAND_NAME} setup --cursor --claude-desktop`,
        "Configure multiple tools",
      ],
      [`${COMMAND_NAME} setup --cursor --debug`, "Enable debug logging"],
      [
        `${COMMAND_NAME} setup --cursor --auto-update`,
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

    keysTable.push(...KEYS_COMMAND_TABLE);

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
        chalk.cyan(`   ${COMMAND_NAME} setup --cursor`),
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

  // Start the setup flow - show logo and load UI
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
  } = await import("./utils/ui.js");
  const chalk = (await import("chalk")).default;
  showIterableLogo(packageJson.version);
  console.log();
  const ora = (await import("ora")).default;
  const spinner = ora();

  try {
    // Step 1: API Key Configuration
    console.log();
    showSection("API Key Configuration", icons.key);
    console.log();

    let apiKey: string | undefined;
    let usedExistingKey = false;
    let selectedExistingMeta: ApiKeyMetadata | undefined;

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
      const keys = await km.listKeys().catch(() => [] as ApiKeyMetadata[]);
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
              choices: keys.map((k) => ({
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
            const meta = keys.find((k) => k.id === chosenId);
            if (!meta) throw new Error("Selected key metadata not found");
            usedExistingKey = true;
            selectedExistingMeta = meta;
          } catch (e) {
            showError(
              e instanceof Error
                ? e.message
                : "Failed to load selected key from storage"
            );
            process.exit(1);
          }
        } else {
          console.log();
        }
      }
    }

    if (!apiKey && !usedExistingKey) {
      const keyManager = getKeyManager();
      await keyManager.initialize();

      const { getSpinner } = await import("./utils/cli-env.js");
      const keySpinner = await getSpinner();

      try {
        const newKeyId = await saveKeyInteractive(
          keyManager,
          null,
          {
            chalk,
            icons,
            showError,
            showSuccess,
            showInfo,
            formatKeyValue,
            linkColor,
            showBox: (await import("./utils/ui.js")).showBox,
          },
          keySpinner,
          {
            skipRestartNotice: true,
            advanced,
            autoActivate: true,
          }
        );

        selectedExistingMeta =
          (await keyManager.getKeyMetadata(newKeyId)) ?? undefined;
      } catch (error) {
        showError(error instanceof Error ? error.message : "Failed to add key");
        process.exit(1);
      }
    } else if (usedExistingKey) {
      const keyManager = getKeyManager();
      await keyManager.initialize();

      console.log();
      if (!selectedExistingMeta?.isActive) {
        const { getSpinner } = await import("./utils/cli-env.js");
        const activateSpinner = await getSpinner();
        activateSpinner.start("Activating key...");
        await keyManager.setActiveKey(selectedExistingMeta!.id);
        activateSpinner.succeed("Key activated successfully");
        showSuccess(
          `"${selectedExistingMeta?.name}" is now your active API key`
        );
      } else {
        showSuccess(
          `"${selectedExistingMeta?.name}" is already your active key`
        );
      }

      console.log();
      displayKeyDetails(selectedExistingMeta!, {
        chalk,
        formatKeyValue,
        linkColor,
      });
      console.log();
      showInfo(
        `To modify permissions, run: ${chalk.cyan(`${COMMAND_NAME} keys update "${selectedExistingMeta?.name}"`)}`
      );
    } else {
      const keyManager = getKeyManager();
      await keyManager.initialize();

      const { getSpinner } = await import("./utils/cli-env.js");
      const keySpinner = await getSpinner();

      try {
        const newKeyId = await saveKeyInteractive(
          keyManager,
          null,
          {
            chalk,
            icons,
            showError,
            showSuccess,
            showInfo,
            formatKeyValue,
            linkColor,
            showBox: (await import("./utils/ui.js")).showBox,
          },
          keySpinner,
          {
            skipRestartNotice: true,
            advanced,
            prefilledApiKey: apiKey as string,
            autoActivate: true,
          }
        );

        selectedExistingMeta =
          (await keyManager.getKeyMetadata(newKeyId)) ?? undefined;
      } catch (error) {
        showError(error instanceof Error ? error.message : "Failed to add key");
        process.exit(1);
      }
    }

    if (!selectedExistingMeta) {
      showError("Failed to get key metadata after setup");
      process.exit(1);
    }

    let mcpEnv: Record<string, string> = pickPersistablePermissionEnv(
      selectedExistingMeta.env || {}
    );

    if (args.includes("--debug")) {
      mcpEnv.ITERABLE_DEBUG = "true";
      mcpEnv.LOG_LEVEL = "debug";
    }

    mcpEnv = enforceSendsRequiresWrites(mcpEnv, (msg) => showWarning(msg));

    // Step 5: Configure AI Tools
    console.log();
    showSection("Configure AI Tools", icons.zap);
    console.log();

    if (tools.length === 0) {
      const { selectedTools } = await inquirer.prompt<{
        selectedTools: ToolName[];
      }>([
        {
          type: "checkbox",
          name: "selectedTools",
          message: "Select your AI tools to configure:",
          choices: [
            { name: "Cursor", value: "cursor" },
            { name: "Claude Desktop", value: "claude-desktop" },
            { name: "Claude Code (CLI)", value: "claude-code" },
            { name: "Gemini CLI", value: "gemini-cli" },
            { name: "Other / Manual Setup", value: "manual" },
          ],
          validate: (arr) =>
            Array.isArray(arr) && arr.length > 0
              ? true
              : "Please select at least one tool",
        },
      ]);
      tools = selectedTools;
      console.log();
    }

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
      console.log();
      useAutoUpdate = enableAutoUpdate;
    }

    const iterableMcpConfig = buildMcpConfig({
      ...(args.includes("--local") && { isLocal: true }),
      env: omitPersistablePermissionEnv(mcpEnv),
      autoUpdate: useAutoUpdate,
    });

    const fileBasedTools = tools.filter(
      (tool): tool is FileBasedToolName => tool in TOOL_CONFIGS
    );
    const needsClaudeCode = tools.includes("claude-code");
    const needsManual = tools.includes("manual");

    if (fileBasedTools.length > 0) {
      const { updateToolConfig } = await import("./utils/tool-config.js");
      for (const tool of fileBasedTools) {
        const configPath = TOOL_CONFIGS[tool];
        const toolName = TOOL_NAMES[tool];
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
        showInfo(
          `After installing, re-run: ${COMMAND_NAME} setup --claude-code`
        );
        process.exit(1);
      }

      const configJson = JSON.stringify(iterableMcpConfig);

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
      showSection("Manual Configuration", icons.rocket);
      console.log();

      const { type, command, args, env } = iterableMcpConfig;

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

    const configuredTools: string[] = [];
    if (fileBasedTools.includes("cursor")) configuredTools.push("Cursor");
    if (fileBasedTools.includes("claude-desktop"))
      configuredTools.push("Claude Desktop");
    if (fileBasedTools.includes("gemini-cli"))
      configuredTools.push("Gemini CLI");
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
      `Manage keys with '${COMMAND_NAME} keys list'`,
      `Switch keys with '${COMMAND_NAME} keys activate <name>'`,
    ];

    showCompletion("Setup Complete!", nextSteps, tips);
  } catch (error) {
    spinner.stop();
    showError(error instanceof Error ? error.message : "Setup failed");
    process.exit(1);
  }
};
