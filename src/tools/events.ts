/**
 * MCP tools for Iterable event operations
 */

import type { IterableClient } from "@iterable/api";
import {
  GetUserEventsByEmailParamsSchema,
  GetUserEventsByUserIdParamsSchema,
  TrackBulkEventsParamsSchema,
  TrackEventParamsSchema,
} from "@iterable/api";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { createTool } from "../schema-utils.js";

export function createEventTools(client: IterableClient): Tool[] {
  return [
    createTool({
      name: "track_event",
      description: "Track a custom event for a user",
      schema: TrackEventParamsSchema,
      execute: (params) => client.trackEvent(params),
    }),

    createTool({
      name: "track_bulk_events",
      description:
        "Track multiple events in a single request for better performance",
      schema: TrackBulkEventsParamsSchema,
      execute: (params) => client.trackBulkEvents(params),
    }),

    createTool({
      name: "get_user_events_by_email",
      description: "Get event history for a user by email address",
      schema: GetUserEventsByEmailParamsSchema,
      execute: (params) => client.getUserEventsByEmail(params),
    }),

    createTool({
      name: "get_user_events_by_user_id",
      description: "Get event history for a user by user ID",
      schema: GetUserEventsByUserIdParamsSchema,
      execute: (params) => client.getUserEventsByUserId(params),
    }),
  ];
}
