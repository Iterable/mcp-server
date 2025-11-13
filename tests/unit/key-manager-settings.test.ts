import { describe, expect, it } from "@jest/globals";
import { randomUUID } from "crypto";
import os from "os";
import path from "path";

import { KeyManager } from "../../src/key-manager";

function makeTempDir(): string {
  return path.join(os.tmpdir(), `iterable-mcp-test-${randomUUID()}`);
}

// Mock executor that just resolves for any security command
const mockExec = async () => "ok";

describe("KeyManager per-key env settings", () => {
  it("stores env overrides on addKey and updates with updateKeyEnv", async () => {
    const km = new KeyManager(makeTempDir(), mockExec);
    await km.initialize();

    const id = await km.addKey(
      "prod",
      "abcdefabcdefabcdefabcdefabcdefab",
      "https://api.iterable.com",
      { ITERABLE_USER_PII: "false", ITERABLE_ENABLE_WRITES: "false" }
    );

    let list = await km.listKeys();
    const meta = list.find((k) => k.id === id)!;
    expect(meta.env?.ITERABLE_USER_PII).toBe("false");
    expect(meta.env?.ITERABLE_ENABLE_WRITES).toBe("false");

    await km.updateKeyEnv(id, { ITERABLE_ENABLE_WRITES: "true" });
    list = await km.listKeys();
    const updated = list.find((k) => k.id === id)!;
    expect(updated.env?.ITERABLE_USER_PII).toBe("false");
    expect(updated.env?.ITERABLE_ENABLE_WRITES).toBe("true");
  });
});
