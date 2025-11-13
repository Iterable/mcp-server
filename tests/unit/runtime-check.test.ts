import { afterEach, describe, expect, it } from "@jest/globals";

import { assertSupportedRuntime } from "../../src/utils/runtime-check.js";

const originalVersions = process.versions;

function withNodeVersion(version: string, fn: () => void) {
  const newVersions = { ...originalVersions, node: version };
  Object.defineProperty(process, "versions", {
    value: newVersions,
    configurable: true,
  });
  try {
    fn();
  } finally {
    // Restore
    Object.defineProperty(process, "versions", {
      value: originalVersions,
      configurable: true,
    });
  }
}

describe("assertSupportedRuntime", () => {
  afterEach(() => {
    // Ensure restored for subsequent tests
    Object.defineProperty(process, "versions", {
      value: originalVersions,
      configurable: true,
    });
  });

  it("should throw on Node 16", () => {
    withNodeVersion("16.20.2", () => {
      expect(() => assertSupportedRuntime()).toThrow(
        /requires Node\.js v20 or newer/i
      );
    });
  });

  it("should throw on Node 18", () => {
    withNodeVersion("18.19.1", () => {
      expect(() => assertSupportedRuntime()).toThrow(
        /requires Node\.js v20 or newer/i
      );
    });
  });

  it("should pass on Node 20", () => {
    withNodeVersion("20.11.1", () => {
      expect(() => assertSupportedRuntime()).not.toThrow();
    });
  });
});
