/**
 * Beautiful CLI UI utilities with modern styling
 */

import boxen from "boxen";
import chalk from "chalk";
import Table from "cli-table3";
import figlet from "figlet";
import gradient from "gradient-string";

import { DOCUMENTATION_URL } from "./command-info.js";
import { isDarkBackground } from "./terminal-theme.js";

// Unified brand/theme palette (Iterable official logo colors)
// Dots: Purple (top), Pink (left), Cyan (right), Teal (bottom)
// Light diamond tints used for gradients and subtle accents
const THEME = {
  // Brand core
  primary: "#5F40D8", // Iterable purple
  accent: "#16C5FF", // Iterable cyan
  brandTeal: "#5DB5A1", // Iterable teal
  brandPink: "#E64F7C", // Iterable pink
  lightLavender: "#E8DFF5",
  lightCyan: "#D4F1F9",
  lightPink: "#FDE2ED",
  lightTeal: "#D5F0EB",

  // UI semantics (mapped to closest brand hues)
  success: "#5DB5A1", // use brand teal for success
  warning: "#F59E0B", // keep amber for accessibility (non-brand)
  error: "#E64F7C", // map error to brand pink (high contrast)
  info: "#16C5FF", // map info to brand cyan

  // Neutrals
  neutralDark: "#111827", // gray-900
  neutral: "#6B7280", // gray-500
  neutralMid: "#374151", // gray-700 — muted labels on light backgrounds
  neutralLight: "#E5E7EB", // gray-200 — muted labels on dark backgrounds
  neutralLighter: "#CBD5E1", // slate-300 (better on dark)
  purpleBright: "#C4B5FD", // violet-300 for dark legibility

  // Links — tuned for contrast on each background
  linkOnDark: "#7DD3FC", // sky-300
  linkOnLight: "#0369A1", // sky-700
} as const;

function mutedHex(): string {
  return isDarkBackground() ? THEME.neutralLight : THEME.neutralMid;
}

function linkHex(): string {
  return isDarkBackground() ? THEME.linkOnDark : THEME.linkOnLight;
}

export function linkColor() {
  const hex = linkHex();
  return chalk.hex(hex);
}

export function valueColor() {
  // Value color for key:value rows; high contrast on both themes
  const dark = isDarkBackground();
  return dark ? chalk.white : chalk.hex(THEME.neutralDark);
}

function successHex(): string {
  // Dark theme: brand teal; Light theme: much darker green for contrast
  return isDarkBackground() ? THEME.success : "#166534"; // green-700
}

function headerGradient(_dark: boolean) {
  // Strong contrast on both dark and light backgrounds
  // Use brand Purple → Pink regardless of background
  const start = THEME.primary;
  const end = THEME.brandPink;
  return gradient(start, end);
}

// Emoji icons for consistent branding
export const icons = {
  rocket: "🚀",
  key: "🔑",
  check: "✅",
  cross: "❌",
  warning: "⚠️",
  info: "ℹ️",
  sparkles: "✨",
  lock: "🔒",
  globe: "🌍",
  zap: "⚡",
  party: "🎉",
  target: "🎯",
  bulb: "💡",
  fire: "🔥",
};

/**
 * Display the Iterable logo in ANSI art with version info
 */
export function showIterableLogo(version: string): void {
  console.clear();
  const dark = isDarkBackground();
  const titleColor = dark ? THEME.neutralLight : THEME.neutralDark;
  const versionColor = dark ? THEME.neutralLighter : THEME.neutralDark;

  const big1 = figlet.textSync("ITERABLE", { font: "ANSI Shadow" }).split("\n");
  const maxLen = Math.max(...big1.map((l) => l.length), 32);
  const grad = headerGradient(dark);
  const bar = grad("━".repeat(maxLen));
  const secondary = (text: string) => chalk.hex(mutedHex())(text);

  const content = [
    bar,
    ...big1.map((l) => grad(l.padEnd(maxLen))),
    bar,
    chalk.bold.hex(titleColor)("Iterable MCP Server") +
      "  " +
      chalk.hex(versionColor)(`v${version}`),
    "",
    secondary("This is currently in beta and it can make mistakes."),
    secondary("Please exercise caution when using this with production data."),
    "",
    secondary("Documentation:") + " " + linkColor()(DOCUMENTATION_URL),
    bar,
  ].join("\n");

  console.log(
    boxen(content, {
      padding: { top: 1, bottom: 0, left: 4, right: 4 },
      margin: { top: 1, bottom: 0 },
      borderStyle: "round",
      borderColor: dark ? THEME.accent : THEME.primary,
    })
  );
}

/**
 * Display a beautiful header with bold ASCII art and gorgeous gradient
 */
export function showHeader(text: string, subtitle?: string): void {
  console.clear();
  console.log();

  // Bold, gorgeous ASCII art using "ANSI Shadow" font
  const asciiArt = figlet.textSync(text, {
    font: "ANSI Shadow",
    horizontalLayout: "default",
    verticalLayout: "default",
  });

  // Apply beautiful, accessible gradient based on background
  const dark = isDarkBackground();
  console.log(headerGradient(dark)(asciiArt));

  if (subtitle) {
    console.log(chalk.gray(centerText(subtitle)));
  }

  console.log();
}

/**
 * Center text in the terminal
 */
function centerText(text: string): string {
  const width = process.stdout.columns || 80;
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return " ".repeat(padding) + text;
}

/**
 * Display a beautiful box with content
 */
export function showBox(
  title: string,
  content: string | string[],
  options: {
    icon?: string;
    theme?: "primary" | "success" | "warning" | "error" | "info";
    padding?: number;
  } = {}
): void {
  const { icon, theme = "primary", padding = 1 } = options;

  const displayTitle = icon ? `${icon}  ${title}` : title;

  const lines = Array.isArray(content) ? content : [content];
  const message = lines.join("\n");

  console.log(
    boxen(message, {
      title: displayTitle,
      titleAlignment: "center",
      padding,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor:
        theme === "primary"
          ? "magenta"
          : theme === "success"
            ? "green"
            : theme === "warning"
              ? "yellow"
              : theme === "error"
                ? "red"
                : "cyan",
    })
  );
}

/**
 * Display a success message
 */
export function showSuccess(message: string): void {
  console.log(chalk.hex(successHex())("  " + icons.check + "  " + message));
}

/**
 * Display an error message
 */
export function showError(message: string): void {
  console.log(chalk.hex(THEME.error)("  " + icons.cross + "  " + message));
}

/**
 * Display a warning message
 */
export function showWarning(message: string): void {
  console.log(chalk.hex(THEME.warning)("  " + icons.warning + "  " + message));
}

/**
 * Prompt user to restart/reload AI tools after switching the active key.
 */
export function showRestartNotice(): void {
  console.log();
  showBox(
    "Action Required",
    [
      chalk.yellow(
        "Restart your AI client or reload its MCP servers to use this key"
      ),
      "",
      chalk.gray(
        "The MCP server loads the active key when it starts. Some clients require fully quitting and reopening the application."
      ),
    ],
    { icon: icons.zap, theme: "warning" }
  );
}

/**
 * Display an info message
 */
export function showInfo(message: string): void {
  console.log(chalk.hex(THEME.info)("  " + icons.info + "  " + message));
}

/**
 * Display a tip message
 */
export function showTip(message: string): void {
  console.log(chalk.hex(THEME.accent)("  " + icons.bulb + "  " + message));
}

/**
 * Create a beautiful table
 */
export function createTable(options: {
  head: string[];
  colWidths?: (number | null)[];
  style?: "compact" | "normal" | "spacious";
}): Table.Table {
  const { head, colWidths, style = "normal" } = options;

  const padding =
    style === "compact"
      ? { left: 1, right: 1 }
      : style === "spacious"
        ? { left: 2, right: 2 }
        : { left: 1, right: 1 };

  const dark = isDarkBackground();
  const headColorHex = dark ? THEME.accent : THEME.primary;
  return new Table({
    head: head.map((h) => chalk.bold.hex(headColorHex)(h)),
    ...(colWidths && { colWidths }),
    wordWrap: true,
    style: {
      head: [],
      border: ["magenta"],
      "padding-left": padding.left,
      "padding-right": padding.right,
    },
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "╭",
      "top-right": "╮",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "╰",
      "bottom-right": "╯",
      left: "│",
      "left-mid": "├",
      mid: "─",
      "mid-mid": "┼",
      right: "│",
      "right-mid": "┤",
      middle: "│",
    },
  });
}

/**
 * Display a section header
 */
export function showSection(title: string, icon?: string): void {
  console.log();
  // Reduce emoji usage by default; enable via ITERABLE_UI_ICONS=true
  const showIcons = process.env.ITERABLE_UI_ICONS === "true";
  const displayTitle = icon && showIcons ? `${icon}  ${title}` : title;
  const dark = isDarkBackground();
  const titleHex = dark ? THEME.purpleBright : THEME.primary;
  const lineHex = mutedHex();
  console.log(chalk.bold.hex(titleHex)(displayTitle));
  console.log(
    chalk.hex(lineHex)("─".repeat(Math.min(displayTitle.length + 2, 60)))
  );
}

/**
 * Display a completion message with celebration
 */
export function showCompletion(
  title: string,
  nextSteps?: string[],
  tips?: string[]
): void {
  console.log();
  console.log(chalk.bold.hex(THEME.success)(title));
  console.log(chalk.hex(mutedHex())("─".repeat(50)));
  console.log();

  if (nextSteps && nextSteps.length > 0) {
    console.log(chalk.bold.hex(THEME.primary)("Next Steps"));
    console.log();
    const itemColor = isDarkBackground()
      ? chalk.whiteBright
      : chalk.hex(THEME.neutralDark);
    nextSteps.forEach((step, idx) => {
      console.log(itemColor(`  ${idx + 1}. ${step}`));
    });
    console.log();
  }

  if (tips && tips.length > 0) {
    console.log(chalk.bold.hex(THEME.accent)("Pro Tips"));
    console.log();
    const muted = chalk.hex(mutedHex());
    tips.forEach((tip) => {
      console.log(muted(`  • ${tip}`));
    });
    console.log();
  }

  console.log(
    chalk.hex(successHex())("Your Iterable MCP server is ready to go!")
  );
  console.log();
}

/**
 * Format a key-value pair for display
 */
export function formatKeyValue(
  key: string,
  value: string,
  color = chalk.white
): string {
  const muted = chalk.hex(mutedHex());
  return `  ${muted(key + ":")} ${color(value)}`;
}

/**
 * Create a beautiful divider
 */
export function showDivider(style: "light" | "heavy" = "light"): void {
  const char = style === "light" ? "─" : "═";
  console.log(chalk.hex(mutedHex())(char.repeat(60)));
}

/**
 * Display a progress indicator
 */
export function showProgress(message: string, done = false): void {
  if (done) {
    console.log(chalk.green(`  ${icons.check}  ${message}`));
  } else {
    const hex = isDarkBackground() ? THEME.accent : THEME.primary;
    console.log(chalk.hex(hex)(`  ${chalk.bold("•")}  ${message}...`));
  }
}

/**
 * Format a stored key entry label for selection lists
 */
export function formatKeychainChoiceLabel(
  name: string,
  endpoint: string,
  isActive: boolean,
  env?: {
    ITERABLE_USER_PII?: string;
    ITERABLE_ENABLE_WRITES?: string;
    ITERABLE_ENABLE_SENDS?: string;
  }
): string {
  const activeBadge = isActive ? chalk.bgGreen.black(" ACTIVE ") + " " : "  ";
  const flags = env
    ? (() => {
        const muted = chalk.hex(mutedHex());
        const on = (s: string) => chalk.green(s);
        const off = (s: string) => chalk.gray(s);
        const pii = env.ITERABLE_USER_PII === "true" ? on("On") : off("Off");
        const writes =
          env.ITERABLE_ENABLE_WRITES === "true" ? on("On") : off("Off");
        const sends =
          env.ITERABLE_ENABLE_SENDS === "true" ? on("On") : off("Off");
        return `${muted("PII:")} ${pii} ${muted("• Writes:")} ${writes} ${muted("• Sends:")} ${sends}`;
      })()
    : "";
  const flagSuffix = flags ? "  " + flags : "";
  return `${activeBadge}${chalk.bold(name)}  ${chalk.hex(linkHex())(endpoint)}${flagSuffix}`;
}
