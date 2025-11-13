import { isHttpsOrLocalhost, isLocalhostHost } from "./url.js";

export interface EndpointPromptDeps {
  inquirer: any; // inquirer module (real or shim)
  icons: { globe?: string };
  chalk: any; // chalk instance
  showError: (message: string) => void;
}

/**
 * Prompt user to select Iterable region or provide a custom endpoint.
 * Returns the validated base URL string.
 */
export async function promptForIterableBaseUrl(
  deps: EndpointPromptDeps
): Promise<string> {
  const { inquirer, icons, chalk, showError } = deps;

  // On Windows consoles, flag/globe emojis often render poorly; hide them.
  const allowFlagEmoji = process.platform !== "win32";
  const globePrefix =
    process.platform !== "win32" ? `${icons.globe || "🌍"}  ` : "";

  const { endpointChoice } = await inquirer.prompt([
    {
      type: "list",
      name: "endpointChoice",
      message: "Select your Iterable region:",
      choices: [
        {
          name: `${allowFlagEmoji ? "🇺🇸  " : ""}US (api.iterable.com)`,
          value: "us",
          short: "US",
        },
        {
          name: `${allowFlagEmoji ? "🇪🇺  " : ""}EU (api.eu.iterable.com)`,
          value: "eu",
          short: "EU",
        },
        {
          name: `${globePrefix}Custom endpoint`,
          value: "custom",
          short: "Custom",
        },
      ],
      default: "us",
    },
  ]);

  if (endpointChoice === "us") return "https://api.iterable.com";
  if (endpointChoice === "eu") return "https://api.eu.iterable.com";

  // Custom endpoint
  const { customUrl } = await inquirer.prompt([
    {
      type: "input",
      name: "customUrl",
      message: "Enter custom API endpoint URL:",
      validate: (input: string) => {
        if (!input) return "URL is required";
        try {
          new URL(input);
          return true;
        } catch {
          return "Invalid URL format";
        }
      },
    },
  ]);

  try {
    const url = new URL(customUrl);
    const isIterableDomain =
      url.hostname === "iterable.com" || url.hostname.endsWith(".iterable.com");
    const isLocalhost = isLocalhostHost(url.hostname);

    if (!isHttpsOrLocalhost(url)) {
      showError(
        "HTTP is not allowed for non-local endpoints. Please use HTTPS."
      );
      throw new Error("insecure-nonlocal");
    }

    if (!isIterableDomain && !isLocalhost) {
      console.log();
      console.log(
        chalk.yellow(
          "You selected a non-Iterable domain. This reduces security assurances and may not be supported."
        )
      );
      const { confirmCustom } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirmCustom",
          message: `Proceed with endpoint ${customUrl}?`,
          default: false,
        },
      ]);
      if (!confirmCustom) {
        showError("Custom endpoint not confirmed.");
        throw new Error("custom-cancelled");
      }
    }
  } catch (e) {
    if (
      (e as Error).message === "insecure-nonlocal" ||
      (e as Error).message === "custom-cancelled"
    ) {
      // Already reported to user by showError; rethrow to let caller decide (likely exit)
      throw e;
    }
    // Should not happen due to validation above
  }

  return customUrl;
}
