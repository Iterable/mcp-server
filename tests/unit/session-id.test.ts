/* eslint-disable simple-import-sort/imports */
import { describe, expect, it } from "@jest/globals";
import { createSessionId } from "../../src/server";

describe("Session ID Generation", () => {
  it("generates a valid UUID v4 format", () => {
    const sessionId = createSessionId();

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    // where y is one of [8, 9, a, b]
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(sessionId).toMatch(uuidV4Regex);
  });

  it("generates unique session IDs", () => {
    const sessionIds = new Set<string>();
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const sessionId = createSessionId();
      expect(sessionIds.has(sessionId)).toBe(false);
      sessionIds.add(sessionId);
    }

    expect(sessionIds.size).toBe(iterations);
  });

  it("generates session IDs of expected length", () => {
    const sessionId = createSessionId();

    // Standard UUID format is 36 characters (32 hex + 4 hyphens)
    expect(sessionId.length).toBe(36);
  });

  it("generates session IDs without sequential patterns", () => {
    const id1 = createSessionId();
    const id2 = createSessionId();
    const id3 = createSessionId();

    // Ensure they're not incrementing or following a pattern
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);

    // Verify no substring similarity (should be cryptographically random)
    const commonPrefix = findCommonPrefix(id1, id2);
    expect(commonPrefix.length).toBeLessThan(5); // Allow for some random overlap
  });

  it("does not use predictable values", () => {
    const beforeTimestamp = Date.now();
    const sessionId = createSessionId();
    const afterTimestamp = Date.now();

    // Verify session ID doesn't contain timestamp in base36
    const timestampBase36 = beforeTimestamp.toString(36);
    expect(sessionId).not.toContain(timestampBase36);

    const timestampBase36After = afterTimestamp.toString(36);
    expect(sessionId).not.toContain(timestampBase36After);
  });

  it("maintains high entropy across multiple generations", () => {
    const sessionIds = Array.from({ length: 100 }, () => createSessionId());

    // Check that each character position has variation
    // For a truly random UUID, each hex position should have varied values
    const positions = new Array(36).fill(0).map(() => new Set<string>());

    sessionIds.forEach((id) => {
      for (let i = 0; i < id.length; i++) {
        positions[i]!.add(id[i]!);
      }
    });

    // Positions 8, 13, 18, 23 are hyphens (should all be the same)
    expect(positions[8]!.size).toBe(1);
    expect(positions[13]!.size).toBe(1);
    expect(positions[18]!.size).toBe(1);
    expect(positions[23]!.size).toBe(1);

    // Position 14 should be '4' for UUID v4
    expect(positions[14]!.size).toBe(1);
    expect(positions[14]!.has("4")).toBe(true);

    // Position 19 should be one of [8, 9, a, b]
    expect(positions[19]!.size).toBeGreaterThan(0);
    expect(positions[19]!.size).toBeLessThanOrEqual(4);

    // Other hex positions should have good variation (at least 2 different values in 100 samples)
    const hexPositions = [
      0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 15, 16, 17, 20, 21, 22, 24, 25, 26,
      27, 28, 29, 30, 31, 32, 33, 34, 35,
    ];

    hexPositions.forEach((pos) => {
      expect(positions[pos]!.size).toBeGreaterThanOrEqual(2);
    });
  });

  it("is suitable for concurrent generation", () => {
    // Simulate concurrent generation
    const promises = Array.from({ length: 100 }, () =>
      Promise.resolve(createSessionId())
    );

    return Promise.all(promises).then((sessionIds) => {
      const uniqueIds = new Set(sessionIds);
      expect(uniqueIds.size).toBe(sessionIds.length);
    });
  });
});

/**
 * Helper function to find common prefix between two strings
 */
function findCommonPrefix(str1: string, str2: string): string {
  let i = 0;
  while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
    i++;
  }
  return str1.slice(0, i);
}
