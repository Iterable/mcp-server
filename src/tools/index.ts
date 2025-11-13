/**
 * Central registry for all Iterable MCP tools
 * Simplified tool creation with registry pattern
 */

import type { IterableClient } from "@iterable/api";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Import all tool creators
import { createCampaignTools } from "./campaigns.js";
import { createCatalogTools } from "./catalogs.js";
import { createEventTools } from "./events.js";
import { createExperimentTools } from "./experiments.js";
import { createExportTools } from "./export.js";
import { createJourneyTools } from "./journeys.js";
import { createListTools } from "./lists.js";
import { createMessagingTools } from "./messaging.js";
import { createSnippetTools } from "./snippets.js";
import { createSubscriptionTools } from "./subscriptions.js";
import { createTemplateTools } from "./templates.js";
import { createUserTools } from "./users.js";
import { createWebhookTools } from "./webhooks.js";

/**
 * Registry of all tool creators
 * Makes it easy to add/remove tool categories
 */
export const TOOL_CREATORS_BY_CATEGORY: {
  category: string;
  creator: (client: IterableClient) => Tool[];
}[] = [
  { category: "Campaigns", creator: createCampaignTools },
  { category: "Catalogs", creator: createCatalogTools },
  { category: "Data Export", creator: createExportTools },
  { category: "Events", creator: createEventTools },
  { category: "Experiments", creator: createExperimentTools },
  { category: "Journeys", creator: createJourneyTools },
  { category: "Lists", creator: createListTools },
  { category: "Messaging", creator: createMessagingTools },
  { category: "Snippets", creator: createSnippetTools },
  { category: "Subscriptions", creator: createSubscriptionTools },
  { category: "Templates", creator: createTemplateTools },
  { category: "Users", creator: createUserTools },
  { category: "Webhooks", creator: createWebhookTools },
] as const;

/**
 * Create all Iterable MCP tools
 */
export function createAllTools(client: IterableClient): Tool[] {
  return TOOL_CREATORS_BY_CATEGORY.flatMap(({ creator }) => creator(client));
}
