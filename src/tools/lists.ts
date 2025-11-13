/**
 * MCP tools for Iterable list operations
 */

import type { IterableClient } from "@iterable/api";
import {
  CreateListParamsSchema,
  DeleteListParamsSchema,
  GetListPreviewUsersParamsSchema,
  GetListSizeParamsSchema,
  GetListsParamsSchema,
  GetListUsersParamsSchema,
  SubscribeToListParamsSchema,
  UnsubscribeFromListParamsSchema,
} from "@iterable/api";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { createTool } from "../schema-utils.js";

export function createListTools(client: IterableClient): Tool[] {
  return [
    createTool({
      name: "get_lists",
      description: "Retrieve user lists",
      schema: GetListsParamsSchema,
      execute: () => client.getLists(),
    }),

    createTool({
      name: "subscribe_to_list",
      description: "Subscribe users to a specific list",
      schema: SubscribeToListParamsSchema,
      execute: (params) => client.subscribeUserToList(params),
    }),
    createTool({
      name: "get_list_users",
      description: "Get users in a specific list",
      schema: GetListUsersParamsSchema,
      execute: (params) => client.getListUsers(params),
    }),
    createTool({
      name: "create_list",
      description: "Create a new user list",
      schema: CreateListParamsSchema,
      execute: (params) => client.createList(params),
    }),
    createTool({
      name: "delete_list",
      description: "Delete a user list",
      schema: DeleteListParamsSchema,
      execute: (params) => client.deleteList(params.listId),
    }),
    createTool({
      name: "unsubscribe_from_list",
      description: "Unsubscribe users from a specific list",
      schema: UnsubscribeFromListParamsSchema,
      execute: (params) => client.unsubscribeUserFromList(params),
    }),
    createTool({
      name: "get_list_size",
      description: "Get the count of users in a specific list",
      schema: GetListSizeParamsSchema,
      execute: (params) => client.getListSize(params),
    }),
    createTool({
      name: "get_list_preview_users",
      description: "Preview users in a list (up to 5000 users)",
      schema: GetListPreviewUsersParamsSchema,
      execute: (params) => client.getListPreviewUsers(params),
    }),
  ];
}
