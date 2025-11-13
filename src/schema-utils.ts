/**
 * Utilities for converting Zod schemas to JSON Schema format
 * This eliminates the need to manually duplicate schema definitions
 */

import {
  type JsonSchema7ObjectType,
  zodToJsonSchema,
} from "@alcyone-labs/zod-to-json-schema";

// Re-export for testing
export { zodToJsonSchema };
import {
  IterableApiError,
  IterableNetworkError,
  IterableRawError,
  IterableResponseValidationError,
} from "@iterable/api";
import { logger as _logger } from "@iterable/api";
import { ErrorCode, McpError, Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/**
 * Tool configuration for MCP tool creation
 */
interface ToolConfig<TSchema extends z.ZodType> {
  name: string;
  description: string;
  schema: TSchema;
  execute: (params: z.infer<TSchema>) => Promise<any>;
}

/**
 * Create an MCP tool with automatic error handling and response formatting
 */
export function createTool<TSchema extends z.ZodType>(
  config: ToolConfig<TSchema>
): Tool {
  const handler = async (args: unknown) => {
    try {
      // Validate input with schema
      const params = config.schema.parse(args);

      // Execute the tool logic
      const result = await config.execute(params);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Validation error: ${error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(", ")}`
        );
      }

      if (error instanceof McpError) {
        throw error;
      }

      // Handle Iterable-specific errors - return structured data when possible
      if (
        error instanceof IterableResponseValidationError ||
        error instanceof IterableApiError ||
        error instanceof IterableRawError
      ) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(error, null, 2),
            },
          ],
        };
      }

      // Network errors don't have useful response data, so throw
      if (error instanceof IterableNetworkError) {
        throw new McpError(
          ErrorCode.InternalError,
          `Iterable network error: ${(error as any).message}`
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${errorMessage}`
      );
    }
  };

  return {
    name: config.name,
    description: config.description,
    inputSchema: zodToJsonSchema(config.schema) as JsonSchema7ObjectType,
    handler,
  };
}
