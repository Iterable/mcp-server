import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

import { isDarkBackground } from "../../src/utils/terminal-theme.js";

describe("isDarkBackground", () => {
  const envKeys = [
    "ITERABLE_UI_THEME",
    "COLORFGBG",
    "TERM_PROGRAM",
    "TERM",
  ] as const;

  const saved: Partial<Record<(typeof envKeys)[number], string | undefined>> =
    {};

  beforeEach(() => {
    for (const key of envKeys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it("respects ITERABLE_UI_THEME override", () => {
    process.env.ITERABLE_UI_THEME = "dark";
    expect(isDarkBackground()).toBe(true);

    process.env.ITERABLE_UI_THEME = "light";
    expect(isDarkBackground()).toBe(false);
  });

  it("uses COLORFGBG when available", () => {
    process.env.COLORFGBG = "15;0";
    expect(isDarkBackground()).toBe(true);

    process.env.COLORFGBG = "0;15";
    expect(isDarkBackground()).toBe(false);
  });

  it("detects known dark terminals", () => {
    process.env.TERM_PROGRAM = "iTerm.app";
    expect(isDarkBackground()).toBe(true);

    process.env.TERM_PROGRAM = "WarpTerminal";
    expect(isDarkBackground()).toBe(true);
  });

  it("detects kitty and alacritty via TERM", () => {
    process.env.TERM = "xterm-kitty";
    expect(isDarkBackground()).toBe(true);

    process.env.TERM = "alacritty";
    expect(isDarkBackground()).toBe(true);
  });

  it("detects Apple Terminal as light", () => {
    process.env.TERM_PROGRAM = "Apple_Terminal";
    expect(isDarkBackground()).toBe(false);
  });

  it("defaults to dark when no signals are available", () => {
    expect(isDarkBackground()).toBe(true);
  });
});
