/**
 * MCP tools for Iterable user operations
 */

import type { IterableClient } from "@iterable/api";
import {
  BulkUpdateUsersParamsSchema,
  DeleteUserByEmailParamsSchema,
  DeleteUserByUserIdParamsSchema,
  GetSentMessagesParamsSchema,
  GetUserByEmailParamsSchema,
  GetUserByIdParamsSchema,
  UpdateEmailParamsSchema,
  UpdateUserParamsSchema,
  UpdateUserSubscriptionsParamsSchema,
} from "@iterable/api";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { createTool } from "../schema-utils.js";

/**
 * Create all user management tools
 */
export function createUserTools(client: IterableClient): Tool[] {
  return [
    createTool({
      name: "get_user_by_email",
      description: "Get user profile information by email address",
      schema: GetUserByEmailParamsSchema,
      execute: (params) => client.getUserByEmail(params.email),
    }),
    createTool({
      name: "get_user_by_user_id",
      description: "Get user profile information by user ID",
      schema: GetUserByIdParamsSchema,
      execute: (params) => client.getUserByUserId(params.userId),
    }),
    createTool({
      name: "update_user",
      description:
        "Update user profile information (accepts email OR userId in params)",
      schema: UpdateUserParamsSchema,
      execute: (params) => client.updateUser(params),
    }),
    createTool({
      name: "delete_user_by_email",
      description:
        "Delete a user by email address (asynchronous - does not prevent future data collection)",
      schema: DeleteUserByEmailParamsSchema,
      execute: (params) => client.deleteUserByEmail(params.email),
    }),
    createTool({
      name: "delete_user_by_user_id",
      description:
        "Delete a user by user ID (asynchronous - does not prevent future data collection, deletes all users with same userId)",
      schema: DeleteUserByUserIdParamsSchema,
      execute: (params) => client.deleteUserByUserId(params.userId),
    }),
    createTool({
      name: "update_email",
      description:
        "Update a user's email address (only use with email-based projects; for userId/hybrid projects, use update_user instead)",
      schema: UpdateEmailParamsSchema,
      execute: (params) => client.updateEmail(params),
    }),
    createTool({
      name: "update_user_subscriptions",
      description:
        "Update user subscriptions (IMPORTANT: overwrites existing data for any non-null fields specified)",
      schema: UpdateUserSubscriptionsParamsSchema,
      execute: (params) => client.updateUserSubscriptions(params),
    }),
    createTool({
      name: "bulk_update_users",
      description: "Update multiple users at once",
      schema: BulkUpdateUsersParamsSchema,
      execute: (params) => client.bulkUpdateUsers(params),
    }),
    createTool({
      name: "get_sent_messages",
      description:
        "Get messages sent to a specific user with optional filtering",
      schema: GetSentMessagesParamsSchema,
      execute: (params) => client.getSentMessages(params),
    }),
    createTool({
      name: "get_user_fields",
      description: "Get all user profile field definitions and their types",
      schema: z.object({}),
      execute: () => client.getUserFields(),
    }),
  ];
}
