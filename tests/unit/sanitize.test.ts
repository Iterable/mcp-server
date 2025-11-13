import { sanitizeString } from "../../src/utils/sanitize";

describe("sanitizeString", () => {
  it("redacts 32-char lowercase hex API keys", () => {
    const key = "abcdefabcdefabcdefabcdefabcdefab"; // 32 hex
    const text = `error: auth failed for key ${key}`;
    const out = sanitizeString(text);
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain(key);
  });

  it("returns input when nothing to redact", () => {
    const text = "no secrets here";
    expect(sanitizeString(text)).toBe(text);
  });
});
