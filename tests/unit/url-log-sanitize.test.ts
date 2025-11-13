import { describe, expect, it } from "@jest/globals";

import { sanitizeUrlForLogs } from "../../src/utils/url";

describe("sanitizeUrlForLogs", () => {
  it("removes query params", () => {
    const input =
      "https://api.iterable.com/users/test@example.com?token=secret&x=1";
    const out = sanitizeUrlForLogs(input);
    expect(out).not.toContain("?");
  });

  it("masks emails in path segments", () => {
    const input = "https://api.iterable.com/users/test@example.com/events";
    const out = sanitizeUrlForLogs(input);
    expect(out).toBe("https://api.iterable.com/users/[REDACTED_EMAIL]/events");
  });

  it("masks long IDs in path segments", () => {
    const id = "1234567890abcdef1234567890abcdef";
    const input = `https://api.iterable.com/users/${id}/events`;
    const out = sanitizeUrlForLogs(input);
    expect(out).toBe("https://api.iterable.com/users/[ID]/events");
  });

  it("handles invalid URLs gracefully", () => {
    const out = sanitizeUrlForLogs("not a url");
    expect(out).toBe("[UNPARSEABLE_URL]");
  });
});
