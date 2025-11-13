import { describe, expect, it } from "@jest/globals";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { filterTools } from "../../src/tool-filter";

const mkTool = (name: string): Tool => ({
  name,
  description: name,
  inputSchema: { type: "object", properties: {} },
  execute: async () => ({}),
});

describe("filterTools with allowSends", () => {
  it("blocks send tools when allowSends=false even if writes allowed", () => {
    const tools: Tool[] = [
      mkTool("send_campaign"),
      mkTool("trigger_campaign"),
      mkTool("schedule_campaign"),
      mkTool("create_campaign"),
      mkTool("track_event"),
      mkTool("track_bulk_events"),
      mkTool("trigger_journey"),
      mkTool("send_email"),
      mkTool("send_sms"),
      mkTool("send_whatsapp"),
      mkTool("send_web_push"),
      mkTool("send_push"),
      mkTool("send_in_app"),
      mkTool("send_email_template_proof"),
      mkTool("send_sms_template_proof"),
      mkTool("send_push_template_proof"),
      mkTool("send_inapp_template_proof"),
      mkTool("deactivate_triggered_campaign"), // not a send
      mkTool("get_campaign"), // read-only
    ];

    const cfg = {
      allowUserPii: true,
      allowWrites: true,
      allowSends: false,
      apiKey: "x",
      baseUrl: "https://api.iterable.com",
    };
    const filtered = filterTools(tools, cfg as any);
    const names = new Set(filtered.map((t) => t.name));
    // send-related blocked
    expect(names.has("send_campaign")).toBe(false);
    expect(names.has("trigger_campaign")).toBe(false);
    expect(names.has("schedule_campaign")).toBe(false);
    expect(names.has("create_campaign")).toBe(false);
    expect(names.has("track_event")).toBe(false);
    expect(names.has("track_bulk_events")).toBe(false);
    expect(names.has("trigger_journey")).toBe(false);
    expect(names.has("send_email")).toBe(false);
    expect(names.has("send_sms")).toBe(false);
    expect(names.has("send_whatsapp")).toBe(false);
    expect(names.has("send_web_push")).toBe(false);
    expect(names.has("send_push")).toBe(false);
    expect(names.has("send_in_app")).toBe(false);
    // non-send writes allowed when allowWrites=true
    expect(names.has("deactivate_triggered_campaign")).toBe(true);
    // read-only always allowed
    expect(names.has("get_campaign")).toBe(true);
  });

  it("allows send tools when allowSends=true and writes allowed", () => {
    const tools: Tool[] = [mkTool("send_campaign"), mkTool("get_campaign")];
    const cfg = {
      allowUserPii: true,
      allowWrites: true,
      allowSends: true,
      apiKey: "x",
      baseUrl: "https://api.iterable.com",
    };
    const names = new Set(filterTools(tools, cfg as any).map((t) => t.name));
    expect(names.has("send_campaign")).toBe(true);
    expect(names.has("get_campaign")).toBe(true);
  });

  it("blocks send tools when writes disabled regardless of allowSends", () => {
    const tools: Tool[] = [mkTool("send_campaign"), mkTool("get_campaign")];
    const cfg = {
      allowUserPii: true,
      allowWrites: false,
      allowSends: true,
      apiKey: "x",
      baseUrl: "https://api.iterable.com",
    };
    const names = new Set(filterTools(tools, cfg as any).map((t) => t.name));
    expect(names.has("send_campaign")).toBe(false);
    expect(names.has("get_campaign")).toBe(true);
  });
});
