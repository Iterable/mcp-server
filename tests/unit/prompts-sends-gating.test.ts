import { describe, expect, it } from "@jest/globals";

import { generatePrompts } from "../../src/prompts";
import { filterTools } from "../../src/tool-filter";
import { createAllTools } from "../../src/tools/index";

describe("Prompts send gating with advanced permissions", () => {
  const mockClient: any = {};

  const getPromptNames = (flags: {
    allowWrites: boolean;
    allowSends: boolean;
  }) => {
    const allTools = createAllTools(mockClient);
    const filtered = filterTools(allTools, {
      allowUserPii: true,
      allowWrites: flags.allowWrites,
      allowSends: flags.allowSends,
    } as any);
    return generatePrompts(filtered).map((p) => p.name);
  };

  const sendPromptNames = [
    "send-email",
    "send-campaign",
    "schedule-campaign",
    "trigger-campaign",
  ];

  it("includes at least one send prompt when both writes and sends are enabled", () => {
    const names = getPromptNames({ allowWrites: true, allowSends: true });
    const present = sendPromptNames.filter((n) => names.includes(n));
    expect(present.length).toBeGreaterThan(0);
  });

  it("excludes send prompts when sends=false even if writes=true", () => {
    const baseline = getPromptNames({ allowWrites: true, allowSends: true });
    const baselineSend = sendPromptNames.filter((n) => baseline.includes(n));
    const names = getPromptNames({ allowWrites: true, allowSends: false });
    baselineSend.forEach((n) => expect(names.includes(n)).toBe(false));
  });

  it("excludes send prompts when writes=false even if sends=true", () => {
    const baseline = getPromptNames({ allowWrites: true, allowSends: true });
    const baselineSend = sendPromptNames.filter((n) => baseline.includes(n));
    const names = getPromptNames({ allowWrites: false, allowSends: true });
    baselineSend.forEach((n) => expect(names.includes(n)).toBe(false));
  });
});
