/**
 * Tests for execFile security refactoring
 * Verifies that we use execFile instead of shell-spawning commands
 */

import { describe, expect, it } from "@jest/globals";

import { findCommand } from "../../src/install.js";

describe("execFile Security", () => {
  it("should find valid system commands without using shell", async () => {
    // Test that findCommand works with a known command
    // This verifies execFile is working correctly
    const result = await findCommand("node");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("should reject commands with shell metacharacters gracefully", async () => {
    // Attempt to find a command with shell injection characters
    // execFile should treat this as a literal command name (which won't exist)
    await expect(findCommand("node; echo pwned")).rejects.toThrow(
      "not found"
    );
  });

  it("should handle non-existent commands without shell execution", async () => {
    // This should fail cleanly without any shell interpretation
    await expect(findCommand("this-command-does-not-exist-xyz")).rejects.toThrow(
      "not found"
    );
  });
});

