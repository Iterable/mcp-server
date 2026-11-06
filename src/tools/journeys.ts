/**
 * MCP tools for Iterable journey (workflow) operations
 */

import type { IterableClient } from "@iterable/api";
import {
  GetJourneysParamsSchema,
  TriggerJourneyParamsSchema,
} from "@iterable/api";

import { createTool, type IterableTool } from "../schema-utils.js";

/**
 * Create all journey management tools
 */
export function createJourneyTools(client: IterableClient): IterableTool[] {
  return [
    createTool({
      name: "get_journeys",
      description:
        "Get journeys (workflows) with optional pagination and state filtering",
      schema: GetJourneysParamsSchema,
      execute: (params) => client.getJourneys(params),
    }),
    createTool({
      name: "trigger_journey",
      description: "Trigger a journey (workflow) for a user",
      schema: TriggerJourneyParamsSchema,
      execute: (params) => client.triggerJourney(params),
    }),
  ];
}
