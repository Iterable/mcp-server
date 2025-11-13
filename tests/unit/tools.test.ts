/**
 * Unit tests for all tool modules
 */

import { IterableClient } from "@iterable/api";

import { createAllTools } from "../../src/tools/index.js";

const EXPECTED_TOOLS = [
  "abort_campaign",
  "activate_triggered_campaign",
  "archive_campaigns",
  "bulk_delete_catalog_items",
  "bulk_update_subscriptions",
  "bulk_update_users",
  "cancel_campaign",
  "cancel_email",
  "cancel_export_job",
  "cancel_in_app",
  "cancel_push",
  "cancel_sms",
  "cancel_web_push",
  "cancel_whatsapp",
  "create_campaign",
  "create_catalog",
  "create_list",
  "create_snippet",
  "deactivate_triggered_campaign",
  "delete_catalog",
  "delete_catalog_item",
  "delete_list",
  "delete_snippet",
  "delete_templates",
  "delete_user_by_email",
  "delete_user_by_user_id",
  "get_available_export_data_types",
  "get_campaign",
  "get_campaign_metrics",
  "get_campaigns",
  "get_catalog_field_mappings",
  "get_catalog_item",
  "get_catalog_items",
  "get_catalogs",
  "get_channels",
  "get_child_campaigns",
  "get_email_template",
  "get_embedded_messages",
  "get_experiment_metrics",
  "get_export_files",
  "get_export_jobs",
  "get_in_app_messages",
  "get_inapp_template",
  "get_journeys",
  "get_list_preview_users",
  "get_list_size",
  "get_list_users",
  "get_lists",
  "get_message_types",
  "get_push_template",
  "get_sent_messages",
  "get_sms_template",
  "get_snippet",
  "get_snippets",
  "get_template_by_client_id",
  "get_templates",
  "get_user_by_email",
  "get_user_by_user_id",
  "get_user_events_by_email",
  "get_user_events_by_user_id",
  "get_user_fields",
  "get_webhooks",
  "partial_update_catalog_item",
  "preview_email_template",
  "preview_inapp_template",
  "replace_catalog_item",
  "schedule_campaign",
  "send_campaign",
  "send_email",
  "send_email_template_proof",
  "send_in_app",
  "send_inapp_template_proof",
  "send_push",
  "send_push_template_proof",
  "send_sms",
  "send_sms_template_proof",
  "send_web_push",
  "send_whatsapp",
  "start_export_job",
  "subscribe_to_list",
  "subscribe_user_by_email",
  "subscribe_user_by_userid",
  "track_bulk_events",
  "track_event",
  "trigger_campaign",
  "trigger_journey",
  "unsubscribe_from_list",
  "unsubscribe_user_by_email",
  "unsubscribe_user_by_userid",
  "update_catalog_field_mappings",
  "update_catalog_items",
  "update_email",
  "update_email_template",
  "update_inapp_template",
  "update_push_template",
  "update_sms_template",
  "update_snippet",
  "update_user",
  "update_user_subscriptions",
  "update_webhook",
  "upsert_email_template",
  "upsert_inapp_template",
  "upsert_push_template",
  "upsert_sms_template",
] as const;

// Create a real client with mocked HTTP layer - this tests actual schemas and business logic
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
};

describe("Tool Modules", () => {
  let client: IterableClient;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create real client with mocked HTTP layer
    client = new IterableClient(
      {
        apiKey: "test-key",
        baseUrl: "https://api.iterable.com",
        timeout: 30000,
      },
      mockAxiosInstance as any
    );
  });

  describe("Tool Creation", () => {
    it("should create all tools without errors", () => {
      const allTools = createAllTools(client);

      expect(Array.isArray(allTools)).toBe(true);
      expect(allTools.length).toBeGreaterThan(0);

      // Verify each tool has required properties
      allTools.forEach((tool) => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
        expect(tool).toHaveProperty("handler");

        expect(typeof tool.name).toBe("string");
        expect(typeof tool.description).toBe("string");
        expect(typeof tool.inputSchema).toBe("object");
        expect(typeof tool.handler).toBe("function");
      });
    });

    it("should have unique tool names", () => {
      const allTools = createAllTools(client);
      const toolNames = allTools.map((tool) => tool.name);
      const uniqueNames = new Set(toolNames);

      expect(uniqueNames.size).toBe(toolNames.length);
    });

    it("should have expected total number of tools", () => {
      const allTools = createAllTools(client);

      // Should have a reasonable number of tools (at least 104, allowing for growth)
      expect(allTools.length).toBeGreaterThanOrEqual(104);
      expect(allTools.length).toBeLessThan(110); // Sanity check
    });

    it("should have tools from all categories", () => {
      const allTools = createAllTools(client);
      const toolNames = allTools.map((tool) => tool.name);

      // Verify exact match against expected tools
      expect(toolNames.sort()).toEqual([...EXPECTED_TOOLS].sort());
    });
  });

  describe("Tool Schemas", () => {
    it("should have valid input schemas", () => {
      const allTools = createAllTools(client);

      allTools.forEach((tool) => {
        const schema = tool.inputSchema;

        expect(schema).toHaveProperty("type");
        expect(schema.type).toBe("object");
        expect(schema).toHaveProperty("properties");
        expect(typeof schema.properties).toBe("object");

        // If there are required fields, they should be an array
        if (schema.required) {
          expect(Array.isArray(schema.required)).toBe(true);
        }
      });
    });
  });
});
