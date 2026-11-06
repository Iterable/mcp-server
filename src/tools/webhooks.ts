/**
 * MCP tools for Iterable webhook operations
 */

import type { IterableClient } from "@iterable/api";
import {
  GetWebhooksParamsSchema,
  UpdateWebhookParamsSchema,
} from "@iterable/api";

import { createTool, type IterableTool } from "../schema-utils.js";

export function createWebhookTools(client: IterableClient): IterableTool[] {
  return [
    createTool({
      name: "get_webhooks",
      description: "Get all webhooks for the project",
      schema: GetWebhooksParamsSchema,
      execute: () => client.getWebhooks(),
    }),
    createTool({
      name: "update_webhook",
      description: "Update a webhook configuration",
      schema: UpdateWebhookParamsSchema,
      execute: (params) => client.updateWebhook(params),
    }),
  ];
}
