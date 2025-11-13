/**
 * API key input utility (masked)
 *
 * Prompts for API key input using inquirer with masking and validation.
 * Input is not echoed and won't be saved to shell history since it's
 * prompted interactively rather than passed as a command-line argument.
 */

import inquirer from "inquirer";

/**
 * Prompt for API key input
 *
 * Uses readline to prompt for input. The key will be visible when typed/pasted,
 * but won't be saved to shell history since it's prompted interactively rather
 * than passed as a command-line argument.
 *
 * @param promptText - The text to display before the input
 * @returns The user's input (trimmed)
 */
export async function promptForApiKey(promptText: string): Promise<string> {
  const { apiKey } = await inquirer.prompt<{
    apiKey: string;
  }>([
    {
      type: "password",
      name: "apiKey",
      message: promptText,
      mask: "*",
      validate: (input: string) => {
        if (!input) return "API key is required";
        if (!/^[a-f0-9]{32}$/.test(input))
          return "API key must be a 32-character lowercase hexadecimal string";
        return true;
      },
    },
  ]);
  return apiKey.trim();
}
