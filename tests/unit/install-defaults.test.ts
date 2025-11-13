import { describe, expect, it } from "@jest/globals";

import { getSecurityDefaults } from "../../src/install";

describe("install security defaults", () => {
  it("always returns false for all defaults (conservative)", () => {
    const r = getSecurityDefaults();
    expect(r.defaultPii).toBe(false);
    expect(r.defaultWrites).toBe(false);
    expect(r.defaultSends).toBe(false);
  });

  it("ignores any active key metadata and still returns false", () => {
    const meta = {
      env: {
        ITERABLE_USER_PII: "true",
        ITERABLE_ENABLE_WRITES: "true",
        ITERABLE_ENABLE_SENDS: "true",
      },
    } as any;
    const r = getSecurityDefaults(meta);
    expect(r.defaultPii).toBe(false);
    expect(r.defaultWrites).toBe(false);
    expect(r.defaultSends).toBe(false);
  });
});
