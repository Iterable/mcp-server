/**
 * Tests for OpenAI-compatible schema validation
 * These tests ensure all tool schemas are compatible with OpenAI's function calling API
 */

import { IterableClient } from "@iterable/api";

import { createAllTools } from "../../src/tools/index.js";

describe("OpenAI Schema Validation", () => {
  let client: IterableClient;

  beforeEach(() => {
    const mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    };

    client = new IterableClient(
      {
        apiKey: "test-key",
        baseUrl: "https://api.iterable.com",
        timeout: 30000,
      },
      mockAxiosInstance as any
    );
  });

  describe("Array Schema Validation", () => {
    it("should have proper items definition for all array parameters", () => {
      const allTools = createAllTools(client);

      allTools.forEach((tool) => {
        const schema = tool.inputSchema;

        // Check all properties for array types
        const checkArrayProperties = (obj: any, path = tool.name) => {
          if (typeof obj !== "object" || obj === null) return;

          if (obj.type === "array") {
            expect(obj).toHaveProperty("items");
            expect(obj.items).toBeDefined();

            // Items should not be empty object (which indicates z.any() conversion issue)
            if (
              typeof obj.items === "object" &&
              Object.keys(obj.items).length === 0
            ) {
              throw new Error(
                `Array at ${path} has empty items object - this indicates z.any() was used and will cause OpenAI validation to fail`
              );
            }
          }

          // Recursively check nested objects
          if (obj.properties) {
            Object.keys(obj.properties).forEach((key) => {
              checkArrayProperties(obj.properties[key], `${path}.${key}`);
            });
          }

          if (obj.items) {
            checkArrayProperties(obj.items, `${path}[]`);
          }
        };

        checkArrayProperties(schema);
      });
    });

    it("should not use z.any() in array schemas", () => {
      // This is a compile-time check - if we have z.array(z.any()) anywhere,
      // it will likely cause OpenAI validation issues
      const allTools = createAllTools(client);

      // Check that problematic tool schemas are fixed
      const embeddedMessagesTool = allTools.find(
        (t) => t.name === "get_embedded_messages"
      );
      expect(embeddedMessagesTool).toBeDefined();

      const placementIdsProperty = embeddedMessagesTool!.inputSchema.properties
        ?.placementIds as any;
      if (placementIdsProperty?.type === "array") {
        expect(placementIdsProperty.items).toBeDefined();
        expect(placementIdsProperty.items.type).toBe("number");
      }
    });
  });

  describe("OpenAI Function Schema Compatibility", () => {
    it("should generate valid OpenAI function schemas", () => {
      const allTools = createAllTools(client);

      allTools.forEach((tool) => {
        // Convert to OpenAI function format
        const openAIFunction = {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        };

        // Validate OpenAI function schema structure
        expect(openAIFunction.parameters.type).toBe("object");
        expect(openAIFunction.parameters).toHaveProperty("properties");

        // Check that all required fields exist in properties
        if (openAIFunction.parameters.required) {
          openAIFunction.parameters.required.forEach((field: string) => {
            expect(openAIFunction.parameters.properties).toHaveProperty(field);
          });
        }
      });
    });

    it("should have proper type definitions for ID fields", () => {
      const allTools = createAllTools(client);

      // Check specific tools that should have number IDs
      const toolsWithNumberIds = [
        "get_embedded_messages", // placementIds should be number[]
        "update_webhook", // channelIds, messageTypeIds should be number[]
      ];

      toolsWithNumberIds.forEach((toolName) => {
        const tool = allTools.find((t) => t.name === toolName);
        if (tool) {
          const schema = tool.inputSchema;

          // Check placementIds in embedded messages
          if (
            toolName === "get_embedded_messages" &&
            schema.properties?.placementIds
          ) {
            const placementIds = schema.properties.placementIds as any;
            if (placementIds.type === "array") {
              expect(placementIds.items.type).toBe("number");
            }
          }

          // Check channelIds and messageTypeIds in webhooks
          if (toolName === "update_webhook") {
            ["channelIds", "messageTypeIds"].forEach((field) => {
              if ((schema.properties as any)?.[field]?.type === "array") {
                expect((schema.properties as any)[field].items.type).toBe(
                  "number"
                );
              }
            });
          }
        }
      });
    });
  });

  describe("Schema Conversion", () => {
    it("should convert Zod schemas to valid JSON Schema", () => {
      const allTools = createAllTools(client);

      allTools.forEach((tool) => {
        // The tool.inputSchema should already be converted JSON Schema
        // But let's verify it's properly formatted
        const schema = tool.inputSchema;

        expect(schema).toHaveProperty("type");
        expect(schema).toHaveProperty("properties");

        // Ensure no Zod-specific properties leaked through
        expect(schema).not.toHaveProperty("_def");
        expect(schema).not.toHaveProperty("parse");
        expect(schema).not.toHaveProperty("safeParse");
      });
    });
  });
});
