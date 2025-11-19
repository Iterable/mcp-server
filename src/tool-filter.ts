/**
 * Tool filtering system for MCP server restrictions
 * Uses safe-list approach: explicitly allow safe tools, block everything else
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import type { McpServerConfig } from "./config.js";

export const NON_PII_TOOLS: Set<string> = new Set([
  "abort_campaign",
  "activate_triggered_campaign",
  "archive_campaigns",
  "bulk_delete_catalog_items",
  "cancel_campaign",
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
  "get_experiment_metrics",
  "get_inapp_template",
  "get_journeys",
  "get_list_size",
  "get_lists",
  "get_message_types",
  "get_push_template",
  "get_sms_template",
  "get_snippet",
  "get_snippets",
  "get_template_by_client_id",
  "get_templates",
  "get_user_fields",
  "get_webhooks",
  "partial_update_catalog_item",
  "replace_catalog_item",
  "schedule_campaign",
  "send_campaign",
  "trigger_campaign",
  "update_catalog_field_mappings",
  "update_catalog_items",
  "update_email_template",
  "update_inapp_template",
  "update_push_template",
  "update_sms_template",
  "update_snippet",
  "update_webhook",
  "upsert_email_template",
  "upsert_inapp_template",
  "upsert_push_template",
  "upsert_sms_template",
]);

export const READ_ONLY_TOOLS: Set<string> = new Set([
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
  "preview_email_template",
  "preview_inapp_template",
]);

/**
 * Tools that can directly or indirectly trigger sending messages.
 * Conservative: includes immediate sends, scheduling, triggers, and event/journey triggers.
 */
export const SEND_TOOLS: Set<string> = new Set([
  // Campaign sends and enablers
  "send_campaign",
  "trigger_campaign",
  "schedule_campaign",
  // Creating a blast campaign can send immediately if sendAt not provided
  "create_campaign",
  // Triggered campaigns can cause sends upon activation; block unless explicitly allowed
  "activate_triggered_campaign",
  // Journey triggers enqueue users which may send
  "trigger_journey",
  // Events may drive sends via triggers/journeys
  "track_event",
  "track_bulk_events",
  // Direct per-user messaging sends
  "send_email",
  "send_sms",
  "send_whatsapp",
  "send_web_push",
  "send_push",
  "send_in_app",
  // Template proof sends (send to specific test recipient)
  "send_email_template_proof",
  "send_sms_template_proof",
  "send_push_template_proof",
  "send_inapp_template_proof",
]);

/**
 * Filter tools based on configuration restrictions
 * Uses safe-list approach: only allow explicitly safe tools
 */
export function filterTools(tools: Tool[], config: McpServerConfig): Tool[] {
  return tools.filter(
    (tool) =>
      (config.allowUserPii || NON_PII_TOOLS.has(tool.name)) &&
      (config.allowWrites || READ_ONLY_TOOLS.has(tool.name)) &&
      (config.allowSends || !SEND_TOOLS.has(tool.name))
  );
}
