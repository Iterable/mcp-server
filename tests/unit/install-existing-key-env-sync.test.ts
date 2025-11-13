import { describe, expect, it } from "@jest/globals";

import { resolveFinalMcpEnv } from "../../src/install.js";

describe("install existing key env sync", () => {
  it("prefers key metadata env values over selected env", () => {
    const selectedEnv = {
      ITERABLE_USER_PII: "false",
      ITERABLE_ENABLE_WRITES: "false",
      ITERABLE_ENABLE_SENDS: "false",
    } as Record<string, string>;

    const keyEnv = {
      ITERABLE_USER_PII: "true",
      ITERABLE_ENABLE_WRITES: "true",
      ITERABLE_ENABLE_SENDS: "true",
    } as Record<string, string>;

    const finalEnv = resolveFinalMcpEnv(selectedEnv, keyEnv);
    expect(finalEnv.ITERABLE_USER_PII).toBe("true");
    expect(finalEnv.ITERABLE_ENABLE_WRITES).toBe("true");
    expect(finalEnv.ITERABLE_ENABLE_SENDS).toBe("true");
  });

  it("falls back to selected env when key env missing", () => {
    const selectedEnv = {
      ITERABLE_USER_PII: "false",
      ITERABLE_ENABLE_WRITES: "true",
      ITERABLE_ENABLE_SENDS: "false",
    } as Record<string, string>;

    const finalEnv = resolveFinalMcpEnv(selectedEnv);
    expect(finalEnv).toEqual(selectedEnv);
  });
});
