import type { IterableClient } from "@iterable/api";
import {
  BulkUpdateSubscriptionsParamsSchema,
  SubscribeUserByEmailParamsSchema,
  SubscribeUserByUserIdParamsSchema,
  UnsubscribeUserByEmailParamsSchema,
  UnsubscribeUserByUserIdParamsSchema,
} from "@iterable/api";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { createTool } from "../schema-utils.js";
export function createSubscriptionTools(client: IterableClient): Tool[] {
  return [
    createTool({
      name: "bulk_update_subscriptions",
      description:
        "Subscribe or unsubscribe multiple users to/from a subscription group",
      schema: BulkUpdateSubscriptionsParamsSchema,
      execute: (params) => client.bulkUpdateSubscriptions(params),
    }),
    createTool({
      name: "subscribe_user_by_email",
      description: "Subscribe a user to a subscription group by email",
      schema: SubscribeUserByEmailParamsSchema,
      execute: (params) => client.subscribeUserByEmail(params),
    }),
    createTool({
      name: "subscribe_user_by_userid",
      description: "Subscribe a user to a subscription group by userId",
      schema: SubscribeUserByUserIdParamsSchema,
      execute: (params) => client.subscribeUserByUserId(params),
    }),
    createTool({
      name: "unsubscribe_user_by_email",
      description: "Unsubscribe a user from a subscription group by email",
      schema: UnsubscribeUserByEmailParamsSchema,
      execute: (params) => client.unsubscribeUserByEmail(params),
    }),
    createTool({
      name: "unsubscribe_user_by_userid",
      description: "Unsubscribe a user from a subscription group by userId",
      schema: UnsubscribeUserByUserIdParamsSchema,
      execute: (params) => client.unsubscribeUserByUserId(params),
    }),
  ];
}
