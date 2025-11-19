/* eslint-disable no-console */
/**
 * CLI commands for API key management with beautiful modern UI
 */

import { execFile, spawn } from "child_process";
import { promises as fs, readFileSync } from "fs";
import inquirer from "inquirer";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const { dirname, join } = path;

import { getSpinner, loadUi } from "./utils/cli-env.js";
import { getKeyStorageMessage } from "./utils/formatting.js";
import { promptForApiKey } from "./utils/password-prompt.js";

const execFileAsync = promisify(execFile);

// Get package version
const packageJson = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
    "utf-8"
  )
) as { version: string };

/**
 * Handle the 'keys' command and its subcommands
 */
export async function handleKeysCommand(): Promise<void> {
  const args = process.argv.slice(2);
  const subCommand = args[1];

  const chalk = (await import("chalk")).default;
  const {
    createTable,
    formatKeyValue,
    icons,
    showBox,
    showError,
    showInfo,
    showIterableLogo,
    showSection,
    showSuccess,
    linkColor,
  } = await loadUi();
  const spinner = await getSpinner();

  const { getKeyManager } = await import("./key-manager.js");
  const keyManager = getKeyManager();

  try {
    spinner.start("Initializing key manager...");
    await keyManager.initialize();
    spinner.succeed("Key manager ready");
  } catch (error) {
    spinner.fail("Failed to initialize key manager");
    showError(error instanceof Error ? error.message : "Unknown error");
    if (process.env.NODE_ENV === "test") {
      return;
    }
    process.exit(1);
  }

  switch (subCommand) {
    case "list": {
      console.clear();
      showIterableLogo(packageJson.version);

      const keys = await keyManager.listKeys();

      if (keys.length === 0) {
        showBox(
          "No API Keys Found",
          [
            chalk.gray("You haven't added any API keys yet."),
            "",
            chalk.cyan("Get started by running:"),
            chalk.bold.white("  iterable-mcp setup"),
          ],
          { icon: icons.key, theme: "info" }
        );
      } else {
        showSection("Stored API Keys", icons.key);
        console.log();

        const table = createTable({
          head: [
            "Name",
            "ID",
            "Endpoint",
            "View PII?",
            "Writes?",
            "Sends?",
            "Created",
            "Status",
          ],
          style: "normal",
        });

        for (const key of keys) {
          const statusBadge = key.isActive
            ? chalk.bgGreen.black(" ACTIVE ")
            : chalk.gray("INACTIVE");

          const createdDate = new Date(key.created).toLocaleDateString(
            "en-US",
            {
              year: "numeric",
              month: "short",
              day: "numeric",
            }
          );

          const endpoint = key.baseUrl.replace("https://", "");
          const pii =
            key.env?.ITERABLE_USER_PII === "true"
              ? chalk.green("Enabled")
              : chalk.gray("Disabled");
          const writes =
            key.env?.ITERABLE_ENABLE_WRITES === "true"
              ? chalk.green("Enabled")
              : chalk.gray("Disabled");
          const sends =
            key.env?.ITERABLE_ENABLE_SENDS === "true"
              ? chalk.green("Enabled")
              : chalk.gray("Disabled");

          table.push([
            chalk.white.bold(key.name),
            chalk.gray(key.id), // show full UUID for copyability
            linkColor()(endpoint),
            pii,
            writes,
            sends,
            chalk.gray(createdDate),
            statusBadge,
          ]);
        }

        console.log(table.toString());
        console.log();

        // Show key management tips
        const tips = [
          "Use " +
            chalk.cyan("keys activate <name>") +
            " to switch between keys",
          "Use " + chalk.cyan("keys add") + " to add a new API key",
          getKeyStorageMessage(),
        ];

        showBox("Quick Tips", tips, {
          icon: icons.bulb,
          theme: "info",
          padding: 1,
        });
      }
      break;
    }

    case "add": {
      console.clear();
      showIterableLogo(packageJson.version);

      // Interactive add flow (no flags; all prompts)
      const { name } = await inquirer.prompt([
        {
          type: "input",
          name: "name",
          message: "Enter a name for this API key:",
          default: "default",
          validate: (input: string) => {
            if (!input) return "Name is required";
            if (input.length > 50) return "Name must be 50 characters or less";
            return true;
          },
        },
      ]);

      const { promptForIterableBaseUrl } = await import(
        "./utils/endpoint-prompt.js"
      );
      let baseUrl: string;
      try {
        baseUrl = await promptForIterableBaseUrl({
          inquirer,
          icons,
          chalk,
          showError,
        });
      } catch {
        process.exit(1);
        return;
      }

      const apiKey = await promptForApiKey(
        "\n  " + icons.lock + "  Enter your Iterable API key: "
      );

      // Basic by default: conservative env flags; optional advanced profile
      let selectedEnv: {
        ITERABLE_USER_PII: "true" | "false";
        ITERABLE_ENABLE_WRITES: "true" | "false";
        ITERABLE_ENABLE_SENDS: "true" | "false";
      } = {
        ITERABLE_USER_PII: "false",
        ITERABLE_ENABLE_WRITES: "false",
        ITERABLE_ENABLE_SENDS: "false",
      };
      const { doAdvanced } = await inquirer.prompt([
        {
          type: "confirm",
          name: "doAdvanced",
          message: "Configure advanced permissions now?",
          default: false,
        },
      ]);
      if (doAdvanced) {
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
        } as any;
      }

      // Check if this API key value already exists
      spinner.start("Checking for duplicate keys...");
      const existingKeyWithValue = await keyManager.findKeyByValue(apiKey);
      spinner.stop();

      if (existingKeyWithValue) {
        console.log();
        showInfo(
          `This API key is already stored as "${existingKeyWithValue.name}"`
        );

        if (!existingKeyWithValue.isActive) {
          console.log();
          console.log(chalk.gray("  To activate this key, run:"));
          console.log(
            chalk.cyan(
              `    iterable-mcp keys activate "${existingKeyWithValue.name}"`
            )
          );
        } else {
          console.log();
          showSuccess(
            `"${existingKeyWithValue.name}" is already your active key`
          );
        }
        console.log();
        break;
      }

      // Add the key
      spinner.start("Storing API key securely...");
      try {
        const id = await keyManager.addKey(name, apiKey, baseUrl, {
          ...selectedEnv,
        });
        spinner.succeed("API key stored successfully!");

        console.log();
        console.log(formatKeyValue("Name", name, chalk.white.bold));
        console.log(formatKeyValue("ID", id, chalk.gray));
        console.log(formatKeyValue("Endpoint", baseUrl, linkColor()));
        console.log(
          formatKeyValue(
            "User PII",
            selectedEnv.ITERABLE_USER_PII === "true"
              ? chalk.green("Enabled")
              : chalk.gray("Disabled")
          )
        );
        console.log(
          formatKeyValue(
            "Writes",
            selectedEnv.ITERABLE_ENABLE_WRITES === "true"
              ? chalk.green("Enabled")
              : chalk.gray("Disabled")
          )
        );
        console.log(
          formatKeyValue(
            "Sends",
            selectedEnv.ITERABLE_ENABLE_SENDS === "true"
              ? chalk.green("Enabled")
              : chalk.gray("Disabled")
          )
        );
        console.log();

        const storageMsg =
          process.platform === "darwin"
            ? "macOS Keychain"
            : process.platform === "win32"
              ? "Windows DPAPI (Encrypted)"
              : "File Storage";
        showSuccess(`Your API key is now stored securely in ${storageMsg}`);

        // Offer to set newly added key as active
        const { activateNow } = await inquirer.prompt([
          {
            type: "confirm",
            name: "activateNow",
            message: `Set "${name}" as your active API key now?`,
            default: true,
          },
        ]);

        if (activateNow) {
          spinner.start("Activating key...");
          await keyManager.setActiveKey(id);
          spinner.succeed("Key activated");
          showSuccess(`"${name}" is now your active key`);
        } else {
          showInfo(
            `Keeping your current active key. Run 'iterable-mcp keys activate "${name}"' to switch later.`
          );
        }
      } catch (error) {
        const { sanitizeString } = await import("./utils/sanitize.js");
        spinner.fail("Failed to add API key");
        const msg =
          error instanceof Error
            ? sanitizeString(error.message)
            : "Unknown error";
        showError(msg);
        process.exit(1);
      }
      break;
    }

    case "activate": {
      console.clear();
      showIterableLogo(packageJson.version);

      const idOrName = args.slice(2).join(" ").trim();
      if (!idOrName) {
        console.log();
        showError("Missing key name or ID");
        console.log();
        console.log(chalk.white.bold("  USAGE"));
        console.log(chalk.white("    iterable-mcp keys activate <name-or-id>"));
        console.log();
        console.log(chalk.white.bold("  EXAMPLE"));
        console.log(chalk.cyan("    iterable-mcp keys activate production"));
        console.log();
        process.exit(1);
      }

      try {
        spinner.start(`Activating key "${idOrName}"...`);

        // First check if the key value is accessible
        try {
          await keyManager.getKey(idOrName);
        } catch (error) {
          spinner.fail("Failed to activate key");
          showError(
            error instanceof Error ? error.message : "Failed to access key"
          );
          console.log();
          showInfo(
            "This key's value is not accessible. Delete and re-add it with: iterable-mcp keys delete <id> && iterable-mcp keys add"
          );
          process.exit(1);
        }

        await keyManager.setActiveKey(idOrName);
        spinner.stop();

        const meta = await keyManager.getActiveKeyMetadata();

        if (meta) {
          console.log();
          showSuccess(`Switched to "${meta.name}"`);
          console.log();
          console.log(formatKeyValue("Name", meta.name, chalk.white.bold));
          console.log(formatKeyValue("ID", meta.id, chalk.gray));
          console.log(formatKeyValue("Endpoint", meta.baseUrl, linkColor()));
          const pii =
            meta.env?.ITERABLE_USER_PII === "true"
              ? chalk.green("Enabled")
              : chalk.gray("Disabled");
          const writes =
            meta.env?.ITERABLE_ENABLE_WRITES === "true"
              ? chalk.green("Enabled")
              : chalk.gray("Disabled");
          const sends =
            meta.env?.ITERABLE_ENABLE_SENDS === "true"
              ? chalk.green("Enabled")
              : chalk.gray("Disabled");
          console.log(formatKeyValue("User PII", pii));
          console.log(formatKeyValue("Writes", writes));
          console.log(formatKeyValue("Sends", sends));

          // Sync configured AI tool JSON files to reflect the active key's flags
          try {
            const {
              resolveFinalMcpEnv,
              enforceSendsRequiresWrites,
              buildMcpConfig,
            } = await import("./install.js");
            let mcpEnv = resolveFinalMcpEnv(
              {
                ITERABLE_USER_PII: "false",
                ITERABLE_ENABLE_WRITES: "false",
                ITERABLE_ENABLE_SENDS: "false",
              },
              meta.env as Record<string, string> | undefined
            );
            mcpEnv = enforceSendsRequiresWrites(mcpEnv);

            // Determine file-based tool config locations (Cursor, Claude Desktop)
            const cursorPath = path.join(os.homedir(), ".cursor", "mcp.json");
            // macOS-only path (we already guard the command to run only on darwin)
            const claudeDesktopPath = path.join(
              os.homedir(),
              "Library",
              "Application Support",
              "Claude",
              "claude_desktop_config.json"
            );

            const targets = [
              { name: "Cursor", file: cursorPath },
              { name: "Claude Desktop", file: claudeDesktopPath },
            ];

            const { updateToolConfig } = await import("./utils/tool-config.js");
            for (const t of targets) {
              try {
                const raw = await fs.readFile(t.file, "utf8").catch(() => "");
                if (!raw) continue;
                const existing = JSON.parse(raw || "{}");
                if (!existing?.mcpServers?.iterable) continue;

                const iterableMcpConfig = buildMcpConfig({
                  env: {
                    ...(existing.mcpServers.iterable.env || {}),
                    ...mcpEnv,
                  },
                });
                await updateToolConfig(t.file, iterableMcpConfig);
                showSuccess(
                  `${t.name} configuration synced to active key permissions`
                );
              } catch {
                // Non-fatal: skip if cannot read/parse/write
              }
            }

            // Update Claude Code CLI registry if available
            try {
              await execFileAsync("claude", ["--version"]);

              // Build config using existing helper (keeps local/npx logic consistent)
              const iterableMcpConfig = buildMcpConfig({ env: mcpEnv });
              const configJson = JSON.stringify(iterableMcpConfig);

              // Remove existing registration (ignore errors)
              await execFileAsync("claude", [
                "mcp",
                "remove",
                "iterable",
              ]).catch(() => {});

              // Add new registration with inherited stdio to show Claude CLI output
              await new Promise<void>((resolve, reject) => {
                const child = spawn(
                  "claude",
                  ["mcp", "add-json", "iterable", configJson],
                  {
                    stdio: "inherit",
                  }
                );
                child.on("close", (code) => {
                  if (code === 0) resolve();
                  else
                    reject(
                      new Error(
                        `claude mcp add-json exited with code ${code ?? "unknown"}`
                      )
                    );
                });
                child.on("error", reject);
              });

              showSuccess(
                "Claude Code configuration synced to active key permissions"
              );
            } catch {
              // If Claude CLI not installed or update fails, skip silently
            }
          } catch {
            // Non-fatal: if syncing fails, continue
          }
        } else {
          console.log();
          showSuccess(`"${idOrName}" is now your active API key`);
        }

        showBox(
          "Action Required",
          [
            chalk.yellow("Restart your AI tools to use this key"),
            "",
            chalk.gray("The new key will be used after restarting:"),
            chalk.white("  • Cursor"),
            chalk.white("  • Claude Desktop"),
            chalk.white("  • Claude Code"),
          ],
          { icon: icons.zap, theme: "warning" }
        );
      } catch (_error) {
        // This only catches "key not found" errors from setActiveKey
        // (API key inaccessibility is handled in the inner try-catch above)
        spinner.fail("Failed to activate key");

        const keys = await keyManager.listKeys();
        const suggestions = keys
          .filter(
            (k) =>
              k.name.toLowerCase().includes(idOrName.toLowerCase()) ||
              k.id.toLowerCase().includes(idOrName.toLowerCase())
          )
          .slice(0, 5);

        showError(`Key not found: ${idOrName}`);

        if (suggestions.length) {
          console.log();
          console.log(chalk.white.bold("  Did you mean one of these?"));
          console.log();
          for (const s of suggestions) {
            console.log(
              chalk.cyan(`    • "${s.name}"`) + chalk.gray(` (ID: ${s.id})`)
            );
          }
          console.log();
        }

        showInfo("If your key name has spaces, wrap it in quotes");
        console.log(
          chalk.gray('    Example: iterable-mcp keys activate "My Prod Key"')
        );
        console.log();

        process.exit(1);
      }
      break;
    }

    case "delete": {
      console.clear();
      showIterableLogo(packageJson.version);

      const idOrName = args[2];
      if (!idOrName) {
        console.log();
        showError("Missing key name or ID");
        console.log();
        console.log(chalk.white.bold("  USAGE"));
        console.log(chalk.white("    iterable-mcp keys delete <id-or-name>"));
        console.log();
        showInfo("Use the key ID (not name) for deletion to ensure uniqueness");
        console.log(
          chalk.gray("  Run 'iterable-mcp keys list' to see key IDs")
        );
        console.log();
        process.exit(1);
      }

      // Resolve id or name to an ID for deletion
      let resolved = idOrName;
      let resolvedMeta: { id: string; name: string } | null = null;
      try {
        const keys = await keyManager.listKeys();
        const meta = keys.find((k) => k.id === idOrName || k.name === idOrName);
        if (!meta) {
          // Provide suggestions
          const suggestions = keys
            .filter(
              (k) =>
                k.name.toLowerCase().includes(idOrName.toLowerCase()) ||
                k.id.toLowerCase().includes(idOrName.toLowerCase())
            )
            .slice(0, 5);
          showError(`Key not found: ${idOrName}`);
          if (suggestions.length) {
            console.log();
            console.log(chalk.white.bold("  Did you mean one of these?"));
            console.log();
            for (const s of suggestions) {
              console.log(
                chalk.cyan(`    • "${s.name}"`) + chalk.gray(` (ID: ${s.id})`)
              );
            }
            console.log();
          }
          showInfo("Run 'iterable-mcp keys list' to view all keys");
          process.exit(1);
        }
        resolved = meta.id;
        resolvedMeta = { id: meta.id, name: meta.name };
      } catch (_error) {
        showError("Unable to resolve key by name or ID");
        process.exit(1);
      }

      // Confirm deletion (non-interactive in tests)
      let confirmDelete = false;
      if (process.env.NODE_ENV !== "test") {
        ({ confirmDelete } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmDelete",
            message: `Permanently delete key "${resolvedMeta?.name ?? idOrName}" (ID: ${resolved})?`,
            default: false,
          },
        ]));
      }

      if (!confirmDelete) {
        showInfo("Deletion cancelled.");
        return;
      }

      spinner.start("Deleting API key...");
      try {
        await keyManager.deleteKey(resolved);
        spinner.succeed("API key deleted successfully");

        console.log();
        console.log(formatKeyValue("ID", resolved, chalk.gray));
        console.log();

        const storageMsg =
          process.platform === "darwin"
            ? "macOS Keychain"
            : process.platform === "win32"
              ? "Windows DPAPI"
              : "File Storage";
        showSuccess(`Key removed from ${storageMsg}`);
      } catch (error) {
        spinner.fail("Failed to delete key");
        showError(error instanceof Error ? error.message : "Unknown error");
        process.exit(1);
      }
      break;
    }

    default: {
      console.clear();
      showIterableLogo(packageJson.version);

      showSection("Available Commands", icons.key);
      console.log();

      const commandsTable = createTable({
        head: ["Command", "Description"],
        colWidths: [30, 50],
        style: "normal",
      });

      commandsTable.push(
        ["list", chalk.gray("View all your stored API keys")],
        ["add", chalk.gray("Add a new API key (interactive)")],
        ["activate <name-or-id>", chalk.gray("Switch to a different key")],
        ["delete <id-or-name>", chalk.gray("Remove a key by ID or name")]
      );

      console.log(commandsTable.toString());
      console.log();
      console.log();

      showSection("Examples", icons.fire);
      console.log();

      console.log(chalk.white.bold("  Add API keys"));
      console.log(
        chalk.gray(
          "  (Interactive prompts: name, region, API key, PII, Writes, Sends)"
        )
      );
      console.log();
      console.log(chalk.cyan("    iterable-mcp keys add"));
      console.log();
      console.log();
      console.log(chalk.white.bold("  Manage your keys"));
      console.log();
      console.log(chalk.cyan("    iterable-mcp keys list"));
      console.log(chalk.cyan("    iterable-mcp keys activate production"));
      console.log(
        chalk.cyan(
          "    iterable-mcp keys delete 3f5d2b07-5b1c-4e86-8f3c-9a1b2c3d4e5f"
        )
      );
      console.log();

      const tips = [
        "API keys are prompted interactively - never stored in shell history",
        "Each API key is tightly coupled to its endpoint (US/EU/custom)",
        process.platform === "darwin"
          ? "Keys are stored securely in macOS Keychain"
          : process.platform === "win32"
            ? "Keys are stored securely using Windows DPAPI"
            : "Keys are stored in ~/.iterable-mcp/keys.json with restricted permissions",
        "Use 'keys list' to see all your keys and their details",
        "The active key (● ACTIVE) is what your AI tools will use",
        "To update a key: delete the old one and add a new one",
      ];

      showBox("Tips & Best Practices", tips, {
        icon: icons.bulb,
        theme: "info",
        padding: 1,
      });
      break;
    }
  }
}
