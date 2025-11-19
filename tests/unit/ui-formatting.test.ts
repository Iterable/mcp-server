/* eslint-disable simple-import-sort/imports */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

import {
  formatKeychainChoiceLabelPlain,
  getKeyStorageMessage,
} from "../../src/utils/formatting";

describe("formatKeychainChoiceLabel", () => {
  it("includes name and endpoint, excludes id", () => {
    const name = "My Key";
    const endpoint = "https://api.iterable.com";
    const id = "12345678-dead-beef-87654321";
    const label = formatKeychainChoiceLabelPlain(name, endpoint, false);
    expect(label).toContain(name);
    expect(label).toContain(endpoint);
    expect(label).not.toContain(id.slice(0, 8));
    expect(label).not.toContain(id);
  });

  it("shows an [ACTIVE] badge when key is active", () => {
    const label = formatKeychainChoiceLabelPlain(
      "Active Key",
      "https://api.iterable.com",
      true
    );
    expect(label.startsWith("[ACTIVE] ")).toBe(true);
  });

  it("shows spacing when key is not active", () => {
    const label = formatKeychainChoiceLabelPlain(
      "Inactive",
      "https://api.iterable.com",
      false
    );
    expect(label.startsWith("  ")).toBe(true);
  });

  it("includes permission flags when provided", () => {
    const label = formatKeychainChoiceLabelPlain(
      "Key",
      "https://api.iterable.com",
      false,
      {
        ITERABLE_USER_PII: "false",
        ITERABLE_ENABLE_WRITES: "true",
        ITERABLE_ENABLE_SENDS: "false",
      }
    );
    expect(label).toContain("PII: Off");
    expect(label).toContain("Writes: On");
    expect(label).toContain("Sends: Off");
  });
});

describe("getKeyStorageMessage", () => {
  let originalPlatform: string;

  beforeEach(() => {
    originalPlatform = process.platform;
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      writable: true,
      configurable: true,
    });
  });

  it("returns macOS Keychain message on darwin", () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
      writable: true,
      configurable: true,
    });
    expect(getKeyStorageMessage()).toBe(
      "Keys are stored securely in macOS Keychain"
    );
  });

  it("returns file message on win32", () => {
    Object.defineProperty(process, "platform", {
      value: "win32",
      writable: true,
      configurable: true,
    });
    expect(getKeyStorageMessage()).toBe(
      "Keys are stored in ~/.iterable-mcp/keys.json"
    );
  });

  it("returns file with permissions message on linux", () => {
    Object.defineProperty(process, "platform", {
      value: "linux",
      writable: true,
      configurable: true,
    });
    expect(getKeyStorageMessage()).toBe(
      "Keys are stored in ~/.iterable-mcp/keys.json with restricted permissions"
    );
  });

  it("adds bullet point prefix when requested", () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
      writable: true,
      configurable: true,
    });
    expect(getKeyStorageMessage(true)).toBe(
      "• Keys are stored securely in macOS Keychain"
    );
  });

  it("omits bullet point by default", () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
      writable: true,
      configurable: true,
    });
    expect(getKeyStorageMessage()).not.toContain("• ");
  });
});
