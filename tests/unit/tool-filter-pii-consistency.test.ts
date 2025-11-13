import { describe, expect, it } from "@jest/globals";

import { NON_PII_TOOLS } from "../../src/tool-filter";

describe("PII tool list consistency", () => {
  it("must not include known PII-capable tools", () => {
    const piiTools = [
      "get_user_by_email",
      "get_user_by_user_id",
      "get_user_events_by_email",
      "get_user_events_by_user_id",
      "get_list_users",
      "get_sent_messages",
    ];
    piiTools.forEach((t) => expect(NON_PII_TOOLS.has(t)).toBe(false));
  });

  it("unknown tools are not automatically allowed (deny-by-default)", () => {
    expect(NON_PII_TOOLS.has("definitely_not_a_real_tool" as any)).toBe(false);
  });
});
