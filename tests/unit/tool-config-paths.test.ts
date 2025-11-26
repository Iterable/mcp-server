import { describe, expect, it } from "@jest/globals";
import os from "os";
import path from "path";

import {
  getClaudeDesktopConfigPath,
  getCursorConfigPath,
  getWindsurfConfigPath,
} from "../../src/utils/tool-config.js";

describe("tool-config paths", () => {
  describe("getCursorConfigPath", () => {
    it("returns path in home directory .cursor folder", () => {
      const configPath = getCursorConfigPath();
      expect(configPath).toBe(path.join(os.homedir(), ".cursor", "mcp.json"));
    });

    it("returns a path ending with mcp.json", () => {
      const configPath = getCursorConfigPath();
      expect(configPath).toMatch(/mcp\.json$/);
    });
  });

  describe("getWindsurfConfigPath", () => {
    it("returns path in home directory .codeium/windsurf folder", () => {
      const configPath = getWindsurfConfigPath();
      expect(configPath).toBe(
        path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json")
      );
    });

    it("returns a path ending with mcp_config.json", () => {
      const configPath = getWindsurfConfigPath();
      expect(configPath).toMatch(/mcp_config\.json$/);
    });

    it("returns a path containing .codeium", () => {
      const configPath = getWindsurfConfigPath();
      expect(configPath).toContain(".codeium");
    });

    it("returns a path containing windsurf", () => {
      const configPath = getWindsurfConfigPath();
      expect(configPath).toContain("windsurf");
    });
  });

  describe("getClaudeDesktopConfigPath", () => {
    it("returns a path ending with claude_desktop_config.json", () => {
      const configPath = getClaudeDesktopConfigPath();
      expect(configPath).toMatch(/claude_desktop_config\.json$/);
    });

    it("returns platform-specific path", () => {
      const configPath = getClaudeDesktopConfigPath();

      switch (process.platform) {
        case "darwin":
          expect(configPath).toContain("Library");
          expect(configPath).toContain("Application Support");
          expect(configPath).toContain("Claude");
          break;
        case "win32":
          expect(configPath).toContain("Claude");
          break;
        default:
          // Linux and others use XDG_CONFIG_HOME or ~/.config
          expect(configPath).toContain("Claude");
          break;
      }
    });
  });

  describe("path consistency", () => {
    it("all config paths are absolute", () => {
      expect(path.isAbsolute(getCursorConfigPath())).toBe(true);
      expect(path.isAbsolute(getWindsurfConfigPath())).toBe(true);
      expect(path.isAbsolute(getClaudeDesktopConfigPath())).toBe(true);
    });

    it("all config paths end with .json", () => {
      expect(getCursorConfigPath()).toMatch(/\.json$/);
      expect(getWindsurfConfigPath()).toMatch(/\.json$/);
      expect(getClaudeDesktopConfigPath()).toMatch(/\.json$/);
    });
  });
});
