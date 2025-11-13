import { describe, expect, it } from "@jest/globals";

import { buildMcpConfig } from "../../src/install";

describe("install --advanced flag env propagation", () => {
  it("preserves ITERABLE_ENABLE_SENDS in MCP env", () => {
    const env = {
      ITERABLE_USER_PII: "false",
      ITERABLE_ENABLE_WRITES: "true",
      ITERABLE_ENABLE_SENDS: "true",
    } as any;

    const cfg = buildMcpConfig({ isLocal: false, env });
    expect(cfg.env.ITERABLE_ENABLE_SENDS).toBe("true");
    expect(cfg.env.ITERABLE_ENABLE_WRITES).toBe("true");
    expect(cfg.env.ITERABLE_USER_PII).toBe("false");
  });

  it("defaults remain conservative when nothing enabled", () => {
    const env = {
      ITERABLE_USER_PII: "false",
      ITERABLE_ENABLE_WRITES: "false",
      ITERABLE_ENABLE_SENDS: "false",
    } as any;

    const cfg = buildMcpConfig({ isLocal: true, env });
    expect(cfg.env.ITERABLE_ENABLE_SENDS).toBe("false");
    expect(cfg.env.ITERABLE_ENABLE_WRITES).toBe("false");
    expect(cfg.env.ITERABLE_USER_PII).toBe("false");
  });
});
