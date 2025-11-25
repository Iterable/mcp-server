/**
 * MCP tools for Iterable snippets operations
 */

import type { IterableClient } from "@iterable/api";
import {
  CreateSnippetParamsSchema,
  DeleteSnippetParamsSchema,
  GetSnippetParamsSchema,
  UpdateSnippetParamsSchema,
} from "@iterable/api";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { createTool } from "../schema-utils.js";

export function createSnippetTools(client: IterableClient): Tool[] {
  // WORKAROUND: Cursor rejects valid JSON Schema with "type": ["string", "number"].
  // We accept strings only and convert numeric strings back to numbers.
  // See: https://github.com/cursor/cursor/issues/3778
  const identifier: z.ZodString = z
    .string()
    .describe(
      "Snippet ID or name (stringified). Provide either a snippet name (string) or snippet ID (as a string)."
    );

  function maybeConvertNumericString(value: string): string | number {
    return /^\d+$/.test(value) ? Number(value) : value;
  }

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
      schema: CreateSnippetParamsSchema,
      execute: (params) => client.createSnippet(params),
    }),

    createTool({
      name: "get_snippet",
      description: "Get a snippet by ID (numeric) or name (string)",
      schema: GetSnippetParamsSchema.extend({ identifier }),
      execute: ({ identifier }) =>
        client.getSnippet({
          identifier: maybeConvertNumericString(identifier),
        }),
    }),

    createTool({
      name: "update_snippet",
      description: "Update a snippet by ID (numeric) or name (string)",
      schema: UpdateSnippetParamsSchema.extend({ identifier }),
      execute: (params) =>
        client.updateSnippet({
          ...params,
          identifier: maybeConvertNumericString(params.identifier),
        }),
    }),

    createTool({
      name: "delete_snippet",
      description: "Delete a snippet by ID (numeric) or name (string)",
      schema: DeleteSnippetParamsSchema.extend({ identifier }),
      execute: ({ identifier }) =>
        client.deleteSnippet({
          identifier: maybeConvertNumericString(identifier),
        }),
    }),
  ];
}
