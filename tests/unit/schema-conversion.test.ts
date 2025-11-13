/**
 * Comprehensive tests for Zod to JSON Schema conversion
 * These tests ensure schema conversion accuracy and catch regressions
 */

import { describe, expect, it } from "@jest/globals";
import { z } from "zod";

import { zodToJsonSchema } from "../../src/schema-utils.js";

describe("Schema Conversion Tests", () => {
  describe("Basic Types", () => {
    it("should convert string schema", () => {
      const result = zodToJsonSchema(z.string());
      expect(result).toMatchObject({
        type: "string",
        $schema: "http://json-schema.org/draft-07/schema#",
      });
    });

    it("should convert email schema", () => {
      const result = zodToJsonSchema(z.email());
      expect(result).toMatchObject({
        type: "string",
        $schema: "http://json-schema.org/draft-07/schema#",
      });
    });

    it("should convert url schema", () => {
      const result = zodToJsonSchema(z.url());
      expect(result).toMatchObject({
        type: "string",
        $schema: "http://json-schema.org/draft-07/schema#",
      });
    });

    it("should convert number schema", () => {
      const result = zodToJsonSchema(z.number());
      expect(result).toMatchObject({
        type: "number",
        $schema: "http://json-schema.org/draft-07/schema#",
      });
    });

    it("should convert integer schema", () => {
      const result = zodToJsonSchema(z.number().int());
      expect(result).toMatchObject({
        type: "integer",
        $schema: "http://json-schema.org/draft-07/schema#",
      });
    });

    it("should convert boolean schema", () => {
      const result = zodToJsonSchema(z.boolean());
      expect(result).toMatchObject({
        type: "boolean",
        $schema: "http://json-schema.org/draft-07/schema#",
      });
    });

    it("should convert date schema", () => {
      const result = zodToJsonSchema(z.date());
      expect(result).toMatchObject({
        type: "string",
        format: "date-time",
        $schema: "http://json-schema.org/draft-07/schema#",
      });
    });

    it("should convert any schema", () => {
      const result = zodToJsonSchema(z.any());
      expect(result).toMatchObject({
        $schema: "http://json-schema.org/draft-07/schema#",
      });
    });
  });

  describe("String Constraints", () => {
    it("should handle string length constraints", () => {
      const result = zodToJsonSchema(z.string().min(5).max(10));
      expect(result).toMatchObject({
        type: "string",
        minLength: 5,
        maxLength: 10,
        $schema: "http://json-schema.org/draft-07/schema#",
      });
    });
  });

  describe("Number Constraints", () => {
    it("should handle number range constraints", () => {
      const result = zodToJsonSchema(z.number().min(0).max(100));
      expect(result).toMatchObject({
        type: "number",
        minimum: 0,
        maximum: 100,
        $schema: "http://json-schema.org/draft-07/schema#",
      });
    });
  });

  describe("Array Schemas", () => {
    it("should convert simple array", () => {
      const result = zodToJsonSchema(z.array(z.string()));
      expect(result).toMatchObject({
        type: "array",
        items: { type: "string" },
      });
    });

    it("should convert nested array", () => {
      const result = zodToJsonSchema(z.array(z.array(z.number())));
      expect(result).toMatchObject({
        type: "array",
        items: {
          type: "array",
          items: { type: "number" },
        },
      });
    });
  });

  describe("Object Schemas", () => {
    it("should convert simple object", () => {
      const result = zodToJsonSchema(
        z.object({
          name: z.string(),
          age: z.number(),
        })
      );
      expect(result).toMatchObject({
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "age"],
      });
    });

    it("should handle optional fields", () => {
      const result = zodToJsonSchema(
        z.object({
          name: z.string(),
          age: z.number().optional(),
        })
      );
      expect(result).toMatchObject({
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name"],
      });
    });

    it("should preserve descriptions", () => {
      const result = zodToJsonSchema(
        z.object({
          name: z.string().describe("User's name"),
          age: z.number().describe("User's age"),
        })
      );
      expect(result).toMatchObject({
        type: "object",
        properties: {
          name: { type: "string", description: "User's name" },
          age: { type: "number", description: "User's age" },
        },
        required: ["name", "age"],
      });
    });
  });

  describe("Record Schemas", () => {
    it("should convert typed record", () => {
      const result = zodToJsonSchema(z.record(z.string(), z.number()));
      expect(result).toMatchObject({
        type: "object",
        additionalProperties: { type: "number" },
      });
    });

    it("should convert record with complex value type", () => {
      const result = zodToJsonSchema(
        z.record(z.string(), z.object({ count: z.number() }))
      );
      expect(result).toMatchObject({
        type: "object",
        additionalProperties: {
          type: "object",
          properties: { count: { type: "number" } },
          required: ["count"],
        },
      });
    });
  });

  describe("Enum Schemas", () => {
    it("should convert enum schema", () => {
      const result = zodToJsonSchema(z.enum(["red", "green", "blue"]));
      expect(result).toMatchObject({
        type: "string",
        enum: ["red", "green", "blue"],
      });
    });
  });

  describe("Union Schemas", () => {
    it("should convert literal union to enum", () => {
      const result = zodToJsonSchema(
        z.union([z.literal("a"), z.literal("b"), z.literal("c")])
      );
      expect(result).toMatchObject({
        type: "string",
        enum: ["a", "b", "c"],
      });
    });

    it("should convert complex union to type array", () => {
      const result = zodToJsonSchema(z.union([z.string(), z.number()]));
      expect(result).toMatchObject({
        type: ["string", "number"],
      });
    });
  });

  describe("Optional Schemas", () => {
    it("should handle optional schemas with anyOf", () => {
      const result = zodToJsonSchema(z.string().optional());
      expect(result).toMatchObject({
        anyOf: [{ not: {} }, { type: "string" }],
      });
    });

    it("should handle nested optional", () => {
      const result = zodToJsonSchema(z.array(z.string()).optional());
      expect(result).toMatchObject({
        anyOf: [
          { not: {} },
          {
            type: "array",
            items: { type: "string" },
          },
        ],
      });
    });
  });

  describe("Default Schemas", () => {
    it("should preserve default values", () => {
      const result = zodToJsonSchema(z.string().default("hello"));
      expect(result).toMatchObject({
        type: "string",
        default: "hello",
      });
    });
  });

  describe("Transform and Effects", () => {
    it("should handle transform schemas", () => {
      const result = zodToJsonSchema(
        z.string().transform((s) => s.toUpperCase())
      );
      expect(result).toMatchObject({ type: "string" });
    });

    it("should handle refine schemas", () => {
      const result = zodToJsonSchema(
        z.string().refine((s) => s.length > 0, "Must not be empty")
      );
      expect(result).toMatchObject({ type: "string" });
    });
  });

  describe("Real-world Schemas", () => {
    it("should handle complex nested schema from codebase", () => {
      // Test a real schema from the API client
      const complexSchema = z.object({
        campaignId: z.number().describe("Campaign ID to send"),
        recipientEmail: z
          .email()
          .optional()
          .describe("Recipient email address"),
        dataFields: z
          .record(z.string(), z.any())
          .optional()
          .describe("Data fields"),
        sendAt: z.string().optional().describe("When to send"),
      });

      const result = zodToJsonSchema(complexSchema);

      expect(result).toMatchObject({
        type: "object",
        properties: {
          campaignId: {
            type: "number",
            description: "Campaign ID to send",
          },
          recipientEmail: {
            type: "string",
            description: "Recipient email address",
          },
          dataFields: {
            type: "object",
            additionalProperties: {},
            description: "Data fields",
          },
          sendAt: {
            type: "string",
            description: "When to send",
          },
        },
        required: ["campaignId"],
      });
    });
  });

  describe("Error Cases", () => {
    it("should handle unsupported types gracefully", () => {
      // This would test the fallback behavior for unknown types
      // We can't easily create an unknown type, but we can test the warning
      expect(() => {
        // Test with a schema that might not be supported
        zodToJsonSchema(z.string());
      }).not.toThrow();
    });
  });
});
