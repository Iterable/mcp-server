import { describe, expect, it } from "@jest/globals";

import { resolveAllowFlags } from "../../src/config";

describe("resolveAllowFlags", () => {
  it("defaults to false when nothing set", () => {
    const r = resolveAllowFlags(undefined, {} as any);
    expect(r.allowUserPii).toBe(false);
    expect(r.allowWrites).toBe(false);
    expect(r.allowSends).toBe(false);
  });

  it("prefers key env over process.env", () => {
    const r = resolveAllowFlags(
      {
        ITERABLE_USER_PII: "true",
        ITERABLE_ENABLE_WRITES: "false",
        ITERABLE_ENABLE_SENDS: "false",
      },
      {
        ITERABLE_USER_PII: "false",
        ITERABLE_ENABLE_WRITES: "true",
        ITERABLE_ENABLE_SENDS: "true",
      } as any
    );
    expect(r.allowUserPii).toBe(true);
    expect(r.allowWrites).toBe(false);
    expect(r.allowSends).toBe(false);
  });

  it("uses process.env when key env missing", () => {
    const r = resolveAllowFlags({ ITERABLE_USER_PII: "true" }, {
      ITERABLE_ENABLE_WRITES: "true",
      ITERABLE_ENABLE_SENDS: "true",
    } as any);
    expect(r.allowUserPii).toBe(true);
    expect(r.allowWrites).toBe(true);
    expect(r.allowSends).toBe(true);
  });
});
