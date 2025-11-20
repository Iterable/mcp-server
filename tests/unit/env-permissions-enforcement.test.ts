import { describe, expect, it, jest } from "@jest/globals";

import {
  enforceSendsRequiresWrites,
  pickPersistablePermissionEnv,
} from "../../src/install.js";

describe("permission env enforcement and filtering", () => {
  it("disables Sends when Writes is false", () => {
    const warn = jest.fn();
    const env = enforceSendsRequiresWrites(
      {
        ITERABLE_USER_PII: "false",
        ITERABLE_ENABLE_WRITES: "false",
        ITERABLE_ENABLE_SENDS: "true",
      },
      warn
    );
    expect(env.ITERABLE_ENABLE_SENDS).toBe("false");
    expect(warn).toHaveBeenCalled();
  });

  it("keeps Sends when Writes is true", () => {
    const env = enforceSendsRequiresWrites({
      ITERABLE_USER_PII: "false",
      ITERABLE_ENABLE_WRITES: "true",
      ITERABLE_ENABLE_SENDS: "true",
    });
    expect(env.ITERABLE_ENABLE_SENDS).toBe("true");
  });

  it("filters persistable env to only permission flags and normalizes", () => {
    const persisted = pickPersistablePermissionEnv({
      ITERABLE_USER_PII: "TRUE" as any,
      ITERABLE_ENABLE_WRITES: "false",
      ITERABLE_ENABLE_SENDS: "true",
      ITERABLE_DEBUG: "true",
      LOG_LEVEL: "debug",
    } as any);
    expect(Object.keys(persisted)).toEqual([
      "ITERABLE_USER_PII",
      "ITERABLE_ENABLE_WRITES",
      "ITERABLE_ENABLE_SENDS",
    ]);
    expect(persisted.ITERABLE_USER_PII).toBe("false"); // normalized
    expect((persisted as any).ITERABLE_DEBUG).toBeUndefined();
  });
});
