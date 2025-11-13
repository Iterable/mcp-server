import { describe, expect, it } from "@jest/globals";

import { SEND_TOOLS } from "../../src/tool-filter";

describe("SEND_TOOLS registry", () => {
  it("contains messaging direct send tools", () => {
    [
      "send_email",
      "send_sms",
      "send_whatsapp",
      "send_web_push",
      "send_push",
      "send_in_app",
    ].forEach((name) => expect(SEND_TOOLS.has(name)).toBe(true));
  });

  it("contains template proof send tools", () => {
    [
      "send_email_template_proof",
      "send_sms_template_proof",
      "send_push_template_proof",
      "send_inapp_template_proof",
    ].forEach((name) => expect(SEND_TOOLS.has(name)).toBe(true));
  });

  it("includes campaign/journey/event-triggered send tools", () => {
    [
      "send_campaign",
      "trigger_campaign",
      "schedule_campaign",
      "create_campaign",
      "activate_triggered_campaign",
      "trigger_journey",
      "track_event",
      "track_bulk_events",
    ].forEach((name) => expect(SEND_TOOLS.has(name)).toBe(true));
  });
});
