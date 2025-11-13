/**
 * MCP tools for Iterable catalog operations
 */

import type { IterableClient } from "@iterable/api";
import {
  BulkDeleteCatalogItemsParamsSchema,
  CreateCatalogParamsSchema,
  DeleteCatalogItemParamsSchema,
  GetCatalogFieldMappingsParamsSchema,
  GetCatalogItemParamsSchema,
  GetCatalogItemsParamsSchema,
  GetCatalogsParamsSchema,
  PartialUpdateCatalogItemParamsSchema,
  ReplaceCatalogItemParamsSchema,
  UpdateCatalogFieldMappingsParamsSchema,
  UpdateCatalogItemParamsSchema,
} from "@iterable/api";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { createTool } from "../schema-utils.js";

export function createCatalogTools(client: IterableClient): Tool[] {
  return [
    createTool({
      name: "create_catalog",
      description: "Create a new catalog",
      schema: CreateCatalogParamsSchema,
      execute: (params) => client.createCatalog(params.catalogName),
    }),
    createTool({
      name: "update_catalog_items",
      description: "Update catalog items",
      schema: UpdateCatalogItemParamsSchema,
      execute: (params) => client.updateCatalogItems(params),
    }),
    createTool({
      name: "get_catalog_item",
      description: "Get a specific catalog item by ID",
      schema: GetCatalogItemParamsSchema,
      execute: (params) =>
        client.getCatalogItem(params.catalogName, params.itemId),
    }),
    createTool({
      name: "delete_catalog_item",
      description: "Delete a specific catalog item by ID",
      schema: DeleteCatalogItemParamsSchema,
      execute: (params) =>
        client.deleteCatalogItem(params.catalogName, params.itemId),
    }),
    createTool({
      name: "get_catalogs",
      description: "Get list of all catalogs with optional pagination",
      schema: GetCatalogsParamsSchema,
      execute: (params) => client.getCatalogs(params),
    }),
    createTool({
      name: "get_catalog_field_mappings",
      description: "Get field mappings and data types for a catalog",
      schema: GetCatalogFieldMappingsParamsSchema,
      execute: (params) => client.getCatalogFieldMappings(params),
    }),
    createTool({
      name: "get_catalog_items",
      description:
        "Get items from a catalog with optional pagination and sorting",
      schema: GetCatalogItemsParamsSchema,
      execute: (params) => client.getCatalogItems(params),
    }),
    createTool({
      name: "delete_catalog",
      description: "Delete a catalog",
      schema: z.object({
        catalogName: z.string().describe("Name of the catalog to delete"),
      }),
      execute: (params) => client.deleteCatalog(params.catalogName),
    }),
    createTool({
      name: "update_catalog_field_mappings",
      description:
        "Update catalog field mappings (data types). Valid types: boolean, date, geo_location, long, double, object, and string",
      schema: UpdateCatalogFieldMappingsParamsSchema,
      execute: (params) => client.updateCatalogFieldMappings(params),
    }),
    createTool({
      name: "bulk_delete_catalog_items",
      description: "Bulk delete catalog items by their IDs",
      schema: BulkDeleteCatalogItemsParamsSchema,
      execute: (params) => client.bulkDeleteCatalogItems(params),
    }),
    createTool({
      name: "partial_update_catalog_item",
      description:
        "Partial update (PATCH) a catalog item - updates only specified fields",
      schema: PartialUpdateCatalogItemParamsSchema,
      execute: (params) => client.partialUpdateCatalogItem(params),
    }),
    createTool({
      name: "replace_catalog_item",
      description:
        "Replace (PUT) a catalog item - replaces the entire item with new value",
      schema: ReplaceCatalogItemParamsSchema,
      execute: (params) => client.replaceCatalogItem(params),
    }),
  ];
}
