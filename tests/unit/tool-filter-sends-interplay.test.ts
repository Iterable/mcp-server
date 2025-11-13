import { describe, expect, it } from "@jest/globals";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { filterTools } from "../../src/tool-filter";

const mkTool = (name: string): Tool => ({
  name,
  description: name,
  inputSchema: { type: "object", properties: {} },
  execute: async () => ({}),
});

describe("send/write interplay", () => {
  const sendTools = [
    "send_campaign",
    "send_email",
    "send_email_template_proof",
  ];

  it("blocks sends when allowSends=false even if writes=true", () => {
    const tools: Tool[] = [...sendTools.map(mkTool), mkTool("get_campaign")];
    const names = new Set(
      filterTools(tools, {
        allowUserPii: true,
        allowWrites: true,
        allowSends: false,
        apiKey: "x",
        baseUrl: "https://api.iterable.com",
      } as any).map((t) => t.name)
    );
    sendTools.forEach((n) => expect(names.has(n)).toBe(false));
    expect(names.has("get_campaign")).toBe(true);
  });

  it("blocks sends when writes=false even if allowSends=true", () => {
    const tools: Tool[] = [...sendTools.map(mkTool), mkTool("get_campaign")];
    const names = new Set(
      filterTools(tools, {
        allowUserPii: true,
        allowWrites: false,
        allowSends: true,
        apiKey: "x",
        baseUrl: "https://api.iterable.com",
      } as any).map((t) => t.name)
    );
    sendTools.forEach((n) => expect(names.has(n)).toBe(false));
    expect(names.has("get_campaign")).toBe(true);
  });

  it("allows sends only when both writes and sends are true", () => {
    const tools: Tool[] = [...sendTools.map(mkTool), mkTool("get_campaign")];
    const names = new Set(
      filterTools(tools, {
        allowUserPii: true,
        allowWrites: true,
        allowSends: true,
        apiKey: "x",
        baseUrl: "https://api.iterable.com",
      } as any).map((t) => t.name)
    );
    sendTools.forEach((n) => expect(names.has(n)).toBe(true));
    expect(names.has("get_campaign")).toBe(true);
  });
});
