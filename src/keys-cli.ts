/* eslint-disable no-console */
/**
 * CLI commands for API key management with beautiful modern UI
 */

import { readFileSync } from "fs";
import inquirer from "inquirer";
import path from "path";
import { fileURLToPath } from "url";

import { COMMAND_NAME, KEYS_COMMAND_TABLE } from "./utils/command-info.js";

const { dirname, join } = path;

import type { ApiKeyMetadata, KeyManager } from "./key-manager.js";
import { getSpinner, loadUi } from "./utils/cli-env.js";
import { promptForIterableBaseUrl } from "./utils/endpoint-prompt.js";
import { getKeyStorageMessage } from "./utils/formatting.js";
import { promptForApiKey } from "./utils/password-prompt.js";
import { sanitizeString } from "./utils/sanitize.js";

// Get package version
const packageJson = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"),
    "utf-8"
  )
) as { version: string };

/**
 * Display key details including permissions
 *
 * @param meta - The key metadata to display
 * @param ui - UI utilities (chalk, formatKeyValue, linkColor)
 */
export function displayKeyDetails(
  meta: ApiKeyMetadata,
  ui: {
    chalk: any;
    formatKeyValue: (key: string, value: string, color?: any) => string;
    linkColor: () => (s: string) => string;
  }
): void {
  const { chalk, formatKeyValue, linkColor } = ui;

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
}

/**
 * Find a key by ID or name, with helpful error messages and suggestions
 *
 * @param keyManager - The key manager instance
 * @param idOrName - The key ID or name to find (if undefined/empty, shows usage and exits)
 * @param commandName - The command name for usage messages (e.g., "update", "delete")
 * @param ui - UI utilities (chalk, showError, showInfo)
 * @returns The found key metadata
 * @throws Exits process if key not found or missing
 */
async function findKeyOrExit(
  keyManager: KeyManager,
  idOrName: string | undefined,
  commandName: string,
  ui: { chalk: any; showError: any; showInfo: any }
): Promise<ApiKeyMetadata> {
  const { chalk, showError, showInfo } = ui;

  // Handle missing or empty argument
  if (!idOrName) {
    console.log();
    showError("Missing key name or ID");
    console.log();
    console.log(chalk.white.bold("  USAGE"));
    console.log(
      chalk.white(`    ${COMMAND_NAME} keys ${commandName} <name-or-id>`)
    );
    console.log();
    console.log(chalk.white.bold("  EXAMPLE"));
    console.log(
      chalk.cyan(`    ${COMMAND_NAME} keys ${commandName} production`)
    );
    console.log();
    showInfo("If your key name has spaces, wrap it in quotes");
    console.log(
      chalk.gray(
        `    Example: ${COMMAND_NAME} keys ${commandName} "My Prod Key"`
      )
    );
    console.log();
    process.exit(1);
  }

  const keys = await keyManager.listKeys();
  const key = keys.find(
    (k: ApiKeyMetadata) => k.id === idOrName || k.name === idOrName
  );

  if (!key) {
    showError(`Key not found: ${idOrName}`);
    showInfo(`Run '${COMMAND_NAME} keys list' to view all keys`);
    process.exit(1);
  }

  return key;
}

/**
 * Interactive flow to save (add or update) an API key
 *
 * Handles the complete flow including:
 * - Prompting for key details
 * - Saving the key
 * - Optionally activating new keys
 * - Showing restart notice for active keys
 *
 * @param keyManager - The key manager instance
 * @param existingKey - If provided, updates this key; otherwise adds a new key
 * @param ui - UI utilities (chalk, icons, etc.)
 * @param spinner - Spinner for loading states
 * @param options - Optional configuration
 *   - skipRestartNotice: skip showing restart notice at the end
 *   - advanced: if true, skip the "configure advanced permissions?" prompt and go straight to advanced mode
 *   - prefilledApiKey: if provided, skip API key prompt and use this value (useful when key comes from environment)
 *   - prefilledName: if provided, skip name prompt and use this value (useful for CLI arguments)
 * @returns The saved key's ID
 */
export async function saveKeyInteractive(
  keyManager: KeyManager,
  existingKeyArg: ApiKeyMetadata | null,
  ui: any,
  spinner: any,
  options?: {
    skipRestartNotice?: boolean;
    advanced?: boolean;
    prefilledApiKey?: string;
    prefilledName?: string;
  }
): Promise<string> {
  const {
    chalk,
    icons,
    showError,
    showSuccess,
    showInfo,
    formatKeyValue,
    linkColor,
    showBox,
  } = ui;

  // Use local variables so we can reassign if duplicate detected
  let isUpdate = !!existingKeyArg;
  let existingKey = existingKeyArg;

  // Helper to validate key name
  const validateKeyName = async (input: string): Promise<string | true> => {
    if (!input) return "Name is required";
    if (input.length > 50) return "Name must be 50 characters or less";

    // Check for duplicate names (skip if updating and keeping the same name)
    if (input !== existingKey?.name) {
      const keys = await keyManager.listKeys();
      if (keys.some((k) => k.name === input)) {
        return `A key named "${input}" already exists. Please choose a different name.`;
      }
    }
    return true;
  };

  // Prompt for name (unless prefilled)
  let name: string;
  if (options?.prefilledName) {
    name = options.prefilledName;
    const validationResult = await validateKeyName(name);
    if (validationResult !== true) {
      showError(validationResult);
      process.exit(1);
    }
    if (!isUpdate) {
      showSuccess(`Creating key: "${name}"`);
      console.log();
    }
  } else {
    const response = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: isUpdate
          ? "Enter a new name, or press Enter to keep current name:"
          : "Enter a name for this API key:",
        default: existingKey?.name || "default",
        validate: validateKeyName,
      },
    ]);
    name = response.name;
  }

  // Prompt for endpoint
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
  }

  // Show current endpoint for updates
  if (isUpdate && existingKey!.baseUrl !== baseUrl) {
    console.log();
    showInfo(`Endpoint changing from ${existingKey!.baseUrl} to ${baseUrl}`);
  }

  // Prompt for API key (optional for updates)
  let apiKey: string;
  if (isUpdate) {
    const { updateApiKey } = await inquirer.prompt([
      {
        type: "confirm",
        name: "updateApiKey",
        message: "Update the API key value?",
        default: false,
      },
    ]);

    if (updateApiKey) {
      console.log();
      apiKey = await promptForApiKey(
        icons.lock + "  Enter your new Iterable API key: "
      );
    } else {
      // Get the existing API key value
      spinner.start("Retrieving existing API key...");
      try {
        const existingApiKey = await keyManager.getKey(existingKey!.id);
        if (!existingApiKey) {
          spinner.fail("Failed to retrieve existing API key");
          showError("Could not access the existing API key value");
          console.log();
          showInfo("You'll need to enter a new API key value");
          apiKey = await promptForApiKey(
            icons.lock + "  Enter your Iterable API key: "
          );
        } else {
          spinner.succeed("Using existing API key");
          apiKey = existingApiKey;
        }
      } catch (error) {
        spinner.fail("Failed to retrieve existing API key");
        showError(
          error instanceof Error ? error.message : "Could not access key"
        );
        console.log();
        showInfo("You'll need to enter a new API key value");
        apiKey = await promptForApiKey(
          icons.lock + "  Enter your Iterable API key: "
        );
      }
    }
  } else {
    // Use prefilled API key if provided (e.g., from environment variable)
    if (options?.prefilledApiKey) {
      apiKey = options.prefilledApiKey;
      showSuccess("Using API key from environment variable");
    } else {
      apiKey = await promptForApiKey(
        icons.lock + "  Enter your Iterable API key: "
      );
    }
  }

  // Get current env settings or use defaults
  const currentEnv = existingKey?.env || {};
  let selectedEnv: {
    ITERABLE_USER_PII: "true" | "false";
    ITERABLE_ENABLE_WRITES: "true" | "false";
    ITERABLE_ENABLE_SENDS: "true" | "false";
  } = {
    ITERABLE_USER_PII:
      (currentEnv.ITERABLE_USER_PII as "true" | "false") || "false",
    ITERABLE_ENABLE_WRITES:
      (currentEnv.ITERABLE_ENABLE_WRITES as "true" | "false") || "false",
    ITERABLE_ENABLE_SENDS:
      (currentEnv.ITERABLE_ENABLE_SENDS as "true" | "false") || "false",
  };

  // Handle advanced mode: true = go to advanced, false = use defaults, undefined = prompt
  let doAdvanced: boolean;

  if (options?.advanced !== undefined) {
    // Explicitly set to true or false - don't prompt
    doAdvanced = options.advanced;
  } else {
    // Not set - prompt the user
    const response = await inquirer.prompt([
      {
        type: "confirm",
        name: "doAdvanced",
        message: isUpdate
          ? "Update advanced permissions?"
          : "Configure advanced permissions now?",
        default: false,
      },
    ]);
    doAdvanced = response.doAdvanced;
  }

  if (doAdvanced) {
    // Pre-select current permissions for updates
    const currentPerms: string[] = [];
    if (selectedEnv.ITERABLE_USER_PII === "true") currentPerms.push("pii");
    if (selectedEnv.ITERABLE_ENABLE_WRITES === "true")
      currentPerms.push("writes");
    if (selectedEnv.ITERABLE_ENABLE_SENDS === "true")
      currentPerms.push("sends");

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
        default: currentPerms,
      },
    ]);

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
  } else if (options?.advanced === false) {
    // Show notice about default permissions when advanced was explicitly set to false
    console.log();
    showInfo(
      "Using secure default permissions (PII, Writes, and Sends disabled)"
    );
    showInfo(
      `Run with --advanced to configure permissions, or use '${COMMAND_NAME} keys update' later`
    );
    console.log();
  }

  // For new keys, check if this API key value already exists
  if (!isUpdate) {
    spinner.start("Checking for duplicate keys...");
    const existingKeyWithValue = await keyManager.findKeyByValue(apiKey);
    spinner.stop();

    if (existingKeyWithValue) {
      console.log();
      showInfo(
        `This API key is already stored as "${existingKeyWithValue.name}"`
      );
      console.log();

      const { updateExisting } = await inquirer.prompt([
        {
          type: "confirm",
          name: "updateExisting",
          message: `Update this key with the new settings?`,
          default: true,
        },
      ]);

      if (!updateExisting) {
        console.log();
        showInfo("Cancelled. The existing key was not modified.");

        if (!existingKeyWithValue.isActive) {
          console.log();
          console.log(chalk.gray("  To activate this key, run:"));
          console.log(
            chalk.cyan(
              `    ${COMMAND_NAME} keys activate "${existingKeyWithValue.name}"`
            )
          );
        } else {
          console.log();
          showSuccess(
            `"${existingKeyWithValue.name}" is already your active key`
          );
        }
        console.log();

        // Return the existing key ID so the setup flow can continue
        return existingKeyWithValue.id;
      }

      // User wants to update - convert this to an update operation
      console.log();
      showInfo(`Updating existing key: "${existingKeyWithValue.name}"`);
      console.log();

      // Convert to update mode and let the rest of the function handle it
      isUpdate = true;
      existingKey = existingKeyWithValue;
    }
  }

  // Save the key
  spinner.start(
    isUpdate ? "Updating API key..." : "Storing API key securely..."
  );
  try {
    const id = isUpdate
      ? await keyManager.updateKey(
          existingKey!.id,
          name,
          apiKey,
          baseUrl,
          selectedEnv
        )
      : await keyManager.addKey(name, apiKey, baseUrl, selectedEnv);

    spinner.succeed(
      isUpdate
        ? "API key updated successfully!"
        : "API key stored successfully!"
    );

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

    showSuccess(
      isUpdate
        ? "Your API key has been updated (encrypted at rest)"
        : "Your API key is now securely stored (encrypted at rest)"
    );

    // Get the final key state
    let savedKey = (await keyManager.listKeys()).find(
      (k: ApiKeyMetadata) => k.id === id
    );

    // Handle activation for any key that isn't active
    if (savedKey) {
      if (savedKey.isActive) {
        // Key is already active (either first key, or was already active before update)
        console.log();
        showSuccess(`"${savedKey.name}" is now your active key`);
      } else {
        // Offer to activate the key
        const { activateNow } = await inquirer.prompt([
          {
            type: "confirm",
            name: "activateNow",
            message: `Set "${savedKey.name}" as your active API key now?`,
            default: !isUpdate, // Default to true for new keys, false for updates
          },
        ]);

        if (activateNow) {
          spinner.start("Activating key...");
          await keyManager.setActiveKey(id);
          spinner.succeed("Key activated");
          showSuccess(`"${savedKey.name}" is now your active key`);
          // Refresh key state after activation
          savedKey = (await keyManager.listKeys()).find(
            (k: ApiKeyMetadata) => k.id === id
          )!;
        } else {
          showInfo(
            `Keeping your current active key. Run '${COMMAND_NAME} keys activate "${savedKey.name}"' to switch later.`
          );
        }
      }
    }

    // Show restart notice if the final key is active (unless skipped for embedded mode)
    if (savedKey?.isActive && !options?.skipRestartNotice) {
      console.log();
      showBox(
        "Action Required",
        [
          chalk.yellow("Restart your AI tools to use this key"),
          "",
          chalk.gray(
            "The MCP server will automatically load the active key when it starts"
          ),
        ],
        { icon: icons.zap, theme: "warning" }
      );
    }

    return id;
  } catch (error) {
    spinner.fail(
      isUpdate ? "Failed to update API key" : "Failed to add API key"
    );
    const msg =
      error instanceof Error ? sanitizeString(error.message) : "Unknown error";
    showError(msg);
    process.exit(1);
  }
}

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

  // Dynamic import for testability (Jest mocks need runtime imports)
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
            chalk.bold.white(`  ${COMMAND_NAME} setup`),
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
            "Modified",
            "Status",
          ],
          style: "normal",
        });

        for (const key of keys) {
          const statusBadge = key.isActive
            ? chalk.bgGreen.black(" ACTIVE ")
            : chalk.gray("INACTIVE");

          // Show updated date if available, otherwise created date
          const dateToShow = key.updated || key.created;
          const formattedDate = new Date(dateToShow).toLocaleDateString(
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
            chalk.gray(formattedDate),
            statusBadge,
          ]);
        }

        console.log(table.toString());
        console.log();

        // Show key management commands
        showBox(
          "Key Management",
          [
            ...KEYS_COMMAND_TABLE.map(
              ([cmd, desc]) => `${chalk.cyan(cmd)} - ${chalk.gray(desc)}`
            ),
            "",
            getKeyStorageMessage(),
          ],
          {
            icon: icons.key,
            theme: "info",
            padding: 1,
          }
        );
      }
      break;
    }

    case "add": {
      console.clear();
      showIterableLogo(packageJson.version);

      await saveKeyInteractive(
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
          showBox,
        },
        spinner,
        args[2] ? { prefilledName: args[2] } : undefined // Optional name argument
      );
      break;
    }

    case "update": {
      console.clear();
      showIterableLogo(packageJson.version);

      // Find the existing key
      const existingKey = await findKeyOrExit(keyManager, args[2], "update", {
        chalk,
        showError,
        showInfo,
      });

      console.log();
      showInfo(`Updating key: "${existingKey.name}"`);
      console.log();

      await saveKeyInteractive(
        keyManager,
        existingKey,
        {
          chalk,
          icons,
          showError,
          showSuccess,
          showInfo,
          formatKeyValue,
          linkColor,
          showBox,
        },
        spinner
      );
      break;
    }

    case "activate": {
      console.clear();
      showIterableLogo(packageJson.version);

      // Find the key first to get better error messages
      const keyToActivate = await findKeyOrExit(
        keyManager,
        args[2],
        "activate",
        { chalk, showError, showInfo }
      );

      spinner.start(`Activating key "${keyToActivate.name}"...`);

      // Check if the key value is accessible
      try {
        await keyManager.getKey(keyToActivate.id);
      } catch (error) {
        spinner.fail("Failed to activate key");
        showError(
          error instanceof Error ? error.message : "Failed to access key"
        );
        console.log();
        showInfo(
          `This key's value is not accessible. Update it with: ${COMMAND_NAME} keys update <name-or-id>`
        );
        process.exit(1);
      }

      await keyManager.setActiveKey(keyToActivate.id);
      spinner.stop();

      const meta = await keyManager.getActiveKeyMetadata();

      if (meta) {
        console.log();
        showSuccess(`Switched to "${meta.name}"`);
        console.log();
        displayKeyDetails(meta, { chalk, formatKeyValue, linkColor });
        console.log();
      } else {
        console.log();
        showSuccess(`"${keyToActivate.name}" is now your active API key`);
      }

      showBox(
        "Action Required",
        [
          chalk.yellow("Restart your AI tools to use this key"),
          "",
          chalk.gray(
            "The MCP server will automatically load the active key when it starts"
          ),
        ],
        { icon: icons.zap, theme: "warning" }
      );
      break;
    }

    case "delete": {
      console.clear();
      showIterableLogo(packageJson.version);

      // Find the key to delete
      const keyToDelete = await findKeyOrExit(keyManager, args[2], "delete", {
        chalk,
        showError,
        showInfo,
      });

      // Confirm deletion (non-interactive in tests)
      let confirmDelete = false;
      if (process.env.NODE_ENV !== "test") {
        ({ confirmDelete } = await inquirer.prompt([
          {
            type: "confirm",
            name: "confirmDelete",
            message: `Permanently delete key "${keyToDelete.name}" (ID: ${keyToDelete.id})?`,
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
        await keyManager.deleteKey(keyToDelete.id);
        spinner.succeed("API key deleted successfully");

        console.log();
        console.log(formatKeyValue("ID", keyToDelete.id, chalk.gray));
        console.log();

        showSuccess("Key securely removed");
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
        colWidths: [45, 40],
        style: "normal",
      });

      // Apply chalk gray to descriptions for styling
      commandsTable.push(
        ...KEYS_COMMAND_TABLE.map(([cmd, desc]) => [cmd, chalk.gray(desc)])
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
      console.log(chalk.cyan(`    ${COMMAND_NAME} keys add`));
      console.log();
      console.log();
      console.log(chalk.white.bold("  Manage your keys"));
      console.log();
      console.log(chalk.cyan(`    ${COMMAND_NAME} keys list`));
      console.log(chalk.cyan(`    ${COMMAND_NAME} keys add production`));
      console.log(chalk.cyan(`    ${COMMAND_NAME} keys update production`));
      console.log(chalk.cyan(`    ${COMMAND_NAME} keys activate production`));
      console.log(
        chalk.cyan(
          `    ${COMMAND_NAME} keys delete 3f5d2b07-5b1c-4e86-8f3c-9a1b2c3d4e5f`
        )
      );
      console.log();

      showBox(
        "Important Notes",
        [
          "API keys are prompted interactively - never stored in shell history",
          "Each API key is tightly coupled to its endpoint (US/EU/custom)",
          getKeyStorageMessage(),
          "The active key (● ACTIVE) is what your AI tools will use",
        ],
        {
          icon: icons.bulb,
          theme: "info",
          padding: 1,
        }
      );
      break;
    }
  }
}
