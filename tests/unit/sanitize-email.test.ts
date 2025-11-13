import { describe, expect, it } from "@jest/globals";

import { sanitizeString } from "../../src/utils/sanitize";

describe("sanitizeString email redaction", () => {
  it("redacts email addresses", () => {
    const input = "Error for user test.user+alias@example-domain.com";
    const out = sanitizeString(input);
    expect(out).toContain("[REDACTED_EMAIL]");
    expect(out).not.toContain("@example-domain.com");
  });

  it("keeps non-email text intact", () => {
    const input = "A simple message without emails";
    const out = sanitizeString(input);
    expect(out).toBe(input);
  });
});
