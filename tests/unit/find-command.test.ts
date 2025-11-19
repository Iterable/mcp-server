/* eslint-disable simple-import-sort/imports */
import { describe, expect, it } from "@jest/globals";
import { findCommand } from "../../src/install";

describe("findCommand", () => {
  it("finds node command successfully", async () => {
    const nodePath = await findCommand("node");
    expect(nodePath).toBeTruthy();
    expect(nodePath).toContain("node");
  });

  it("throws error for non-existent command", async () => {
    await expect(
      findCommand("this-command-does-not-exist-xyz")
    ).rejects.toThrow("not found");
  });
});
