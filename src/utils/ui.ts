/**
 * Beautiful CLI UI utilities with modern styling
 */

import boxen from "boxen";
import chalk from "chalk";
import Table from "cli-table3";
import figlet from "figlet";
import gradient from "gradient-string";

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
  neutralLight: "#E5E7EB", // gray-200
  neutralLighter: "#CBD5E1", // slate-300 (better on dark)
  purpleBright: "#C4B5FD", // violet-300 for dark legibility
} as const;

function linkHex(): string {
  // Use brighter cyan on dark backgrounds for better visibility
  // Use darker blue on light backgrounds for readability
  return isDarkBackground() ? "#7DD3FC" : "#0369A1"; // sky-300 on dark, sky-700 on light
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
// Detect terminal background (best-effort).
// Order of precedence:
// 1) Explicit override via ITERABLE_UI_THEME=dark|light
// 2) COLORFGBG heuristic when available
// 3) Check for NO_COLOR or other accessibility envs
// 4) Known terminals with improved detection
// 5) Fallback: safer to assume LIGHT to avoid dark-text-on-dark-background issues
function isDarkBackground(): boolean {
  const override = (process.env.ITERABLE_UI_THEME || "").toLowerCase();
  if (override === "dark") return true;
  if (override === "light") return false;

  // Check for NO_COLOR or similar accessibility settings
  if (process.env.NO_COLOR) {
    // When NO_COLOR is set, assume light background for better contrast
    return false;
  }

  // COLORFGBG heuristic (commonly set in many terminals)
  const cfg = process.env.COLORFGBG;
  if (cfg) {
    const parts = cfg.split(";");
    const bg = parseInt(parts[parts.length - 1] || "", 10);
    if (!Number.isNaN(bg)) {
      // 0-7 are dark colors, 8-15 are light colors
      return bg <= 7;
    }
  }

  // Terminal-specific detection
  const term = process.env.TERM_PROGRAM;
  const termProgram = (term || "").toLowerCase();

  // Known light-background terminals
  if (term === "Apple_Terminal") {
    // macOS default Terminal.app typically uses light background
    return false;
  }

  // Known dark-background terminals
  if (
    term === "iTerm.app" ||
    term === "WezTerm" ||
    term === "Ghostty" ||
    term === "vscode" ||
    termProgram.includes("hyper") ||
    termProgram.includes("warp")
  ) {
    return true;
  }

  // Check TERM environment variable for additional hints
  const termEnv = (process.env.TERM || "").toLowerCase();
  if (termEnv.includes("256color") || termEnv.includes("24bit")) {
    // Modern terminals with 256 colors typically default to dark
    // But this is a weak signal, so we'll still fall back to light
  }

  // IMPORTANT: Fallback to LIGHT background assumption
  // This is safer because dark text on light is more readable
  // than light/colored text on potentially-dark backgrounds
  // Users can always override with ITERABLE_UI_THEME=dark
  return false;
}

export function showIterableLogo(version: string): void {
  console.clear();
  const dark = isDarkBackground();
  const titleColor = dark ? THEME.neutralLight : THEME.neutralDark;
  const versionColor = dark ? THEME.neutralLighter : THEME.neutralDark;
  // Gradient colors are chosen inside headerGradient(dark)

  const big1 = figlet.textSync("ITERABLE", { font: "ANSI Shadow" }).split("\n");
  const maxLen = Math.max(...big1.map((l) => l.length), 32);
  const grad = headerGradient(dark);
  const bar = "━".repeat(maxLen);

  const lines: string[] = [];
  lines.push(grad(bar));
  big1.forEach((l) => lines.push(grad(l.padEnd(maxLen))));
  lines.push(grad(bar));
  lines.push(
    chalk.bold.hex(titleColor)("Iterable MCP Server") +
      "  " +
      chalk.hex(versionColor)(`v${version}`)
  );
  // Beta disclaimer with adaptive contrast
  if (dark) {
    const disclaimerHex = THEME.neutral; // slightly muted on dark
    lines.push(
      chalk
        .hex(disclaimerHex)
        .dim("This is currently in beta and it can make mistakes.")
    );
    lines.push(
      chalk
        .hex(disclaimerHex)
        .dim("Please exercise caution when using this with production data.")
    );
  } else {
    const disclaimerHex = THEME.neutralDark; // higher contrast on light backgrounds
    lines.push(
      chalk.hex(disclaimerHex)(
        "This is currently in beta and it can make mistakes."
      )
    );
    lines.push(
      chalk.hex(disclaimerHex)(
        "Please exercise caution when using this with production data."
      )
    );
  }
  lines.push(grad(bar));

  const content = lines.join("\n");

  console.log(
    boxen(content, {
      padding: { top: 1, bottom: 1, left: 4, right: 4 },
      margin: { top: 1, bottom: 1 },
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
  const lineHex = dark ? "#E5E7EB" : "#374151"; // gray-200 on dark, gray-700 on light
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
  console.log(
    chalk.hex(isDarkBackground() ? "#E5E7EB" : "#374151")(
      // gray-200 on dark, gray-700 on light
      "─".repeat(50)
    )
  );
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
    const muted = chalk.hex(
      isDarkBackground() ? "#E5E7EB" : "#374151" // gray-200 on dark, gray-700 on light
    );
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
  // Use brighter colors on dark backgrounds for better contrast
  // On dark: use bright gray (#E5E7EB = gray-200)
  // On light: use darker gray for contrast
  const muted = chalk.hex(
    isDarkBackground() ? "#E5E7EB" : "#374151" // gray-200 on dark, gray-700 on light
  );
  return `  ${muted(key + ":")} ${color(value)}`;
}

/**
 * Create a beautiful divider
 */
export function showDivider(style: "light" | "heavy" = "light"): void {
  const char = style === "light" ? "─" : "═";
  console.log(
    chalk.hex(isDarkBackground() ? "#E5E7EB" : "#374151")(
      // gray-200 on dark, gray-700 on light
      char.repeat(60)
    )
  );
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
        // Use brighter muted color on dark backgrounds for better visibility
        const muted = chalk.hex(
          isDarkBackground() ? "#E5E7EB" : "#6B7280" // gray-200 on dark, gray-500 on light
        );
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
