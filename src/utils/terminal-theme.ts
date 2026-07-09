/**
 * Best-effort terminal background detection for adaptive CLI colors.
 *
 * Order of precedence:
 * 1) ITERABLE_UI_THEME=dark|light
 * 2) COLORFGBG heuristic
 * 3) Known light terminal programs (Apple Terminal)
 * 4) Known dark terminal programs and TERM values
 * 5) Fallback: dark (most dev terminals default dark)
 */
export function isDarkBackground(): boolean {
  const override = (process.env.ITERABLE_UI_THEME || "").toLowerCase();
  if (override === "dark") return true;
  if (override === "light") return false;

  const cfg = process.env.COLORFGBG;
  if (cfg) {
    const parts = cfg.split(";");
    const bg = parseInt(parts[parts.length - 1] || "", 10);
    if (!Number.isNaN(bg)) {
      return bg <= 7; // 0-7 dark, 8-15 light
    }
  }

  const term = process.env.TERM_PROGRAM;
  const termProgram = (term || "").toLowerCase();

  if (term === "Apple_Terminal") {
    return false;
  }

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

  const termEnv = (process.env.TERM || "").toLowerCase();
  if (termEnv.includes("kitty") || termEnv.includes("alacritty")) {
    return true;
  }

  return true;
}
