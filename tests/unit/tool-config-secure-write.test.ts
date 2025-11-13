import { describe, expect, it } from "@jest/globals";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

import { updateToolConfig } from "../../src/utils/tool-config.js";

describe("tool-config secure writes", () => {
  it("writes config files with 0600 permissions", async () => {
    const tmpDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "iterable-mcp-test-")
    );
    const filePath = path.join(tmpDir, "config.json");

    const iterableConfig = {
      type: "stdio" as const,
      command: "node",
      args: ["/dev/null"],
      env: { ITERABLE_USER_PII: "false" },
    };

    await updateToolConfig(filePath, iterableConfig);

    const stat = await fs.stat(filePath);
    // Only check on POSIX systems
    if (os.platform() !== "win32") {
      const mode = stat.mode & 0o777;
      expect(mode).toBe(0o600);
    } else {
      expect(stat.isFile()).toBe(true);
    }
  });
});
