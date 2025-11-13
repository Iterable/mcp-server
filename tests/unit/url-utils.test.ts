/* eslint-disable simple-import-sort/imports */
import { describe, expect, it } from "@jest/globals";
import { isLocalhostHost, isHttpsOrLocalhost } from "../../src/utils/url";

describe("url utils", () => {
  it("detects localhost variants", () => {
    expect(isLocalhostHost("localhost")).toBe(true);
    expect(isLocalhostHost("localhost:3000")).toBe(true);
    expect(isLocalhostHost("127.0.0.1")).toBe(true);
    expect(isLocalhostHost("::1")).toBe(true);
    expect(isLocalhostHost("api.iterable.com")).toBe(false);
  });

  it("accepts https or localhost", () => {
    expect(isHttpsOrLocalhost(new URL("https://api.iterable.com"))).toBe(true);
    expect(isHttpsOrLocalhost(new URL("http://api.iterable.com"))).toBe(false);
    expect(isHttpsOrLocalhost(new URL("http://localhost:8080"))).toBe(true);
    expect(isHttpsOrLocalhost(new URL("http://127.0.0.1"))).toBe(true);
  });
});
