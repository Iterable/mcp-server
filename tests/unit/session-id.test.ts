/* eslint-disable simple-import-sort/imports */
import { describe, expect, it } from "@jest/globals";
import { createSessionId } from "../../src/server";

describe("Session ID Generation", () => {
  it("generates unique session IDs", () => {
    const id1 = createSessionId();
    const id2 = createSessionId();
    const id3 = createSessionId();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });
});
