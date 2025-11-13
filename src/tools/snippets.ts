/**
 * MCP tools for Iterable snippets operations
 */

import type { IterableClient } from "@iterable/api";
import {
  CreateSnippetRequestSchema,
  DeleteSnippetParamsSchema,
  GetSnippetParamsSchema,
  UpdateSnippetRequestSchema,
} from "@iterable/api";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { createTool } from "../schema-utils.js";

export function createSnippetTools(client: IterableClient): Tool[] {
  return [
    createTool({
      name: "get_snippets",
      description: "Get all snippets for the current project",
      schema: z.object({}),
      execute: () => client.getSnippets(),
    }),

    createTool({
      name: "create_snippet",
      description: "Create a new snippet with Handlebars templating support",
      schema: CreateSnippetRequestSchema,
      execute: (params) => client.createSnippet(params),
    }),

    createTool({
      name: "get_snippet",
      description: "Get a snippet by ID (numeric) or name (string)",
      schema: GetSnippetParamsSchema,
      execute: (params) => client.getSnippet(params),
    }),

    createTool({
      name: "update_snippet",
      description: "Update a snippet by ID (numeric) or name (string)",
      schema: z.object({
        identifier: z
          .union([z.string(), z.number()])
          .describe("Snippet ID (numeric) or name (string)"),
        body: UpdateSnippetRequestSchema.describe("Snippet update data"),
      }),
      execute: (params) =>
        client.updateSnippet({ identifier: params.identifier }, params.body),
    }),

    createTool({
      name: "delete_snippet",
      description: "Delete a snippet by ID (numeric) or name (string)",
      schema: DeleteSnippetParamsSchema,
      execute: (params) => client.deleteSnippet(params),
    }),
  ];
}
