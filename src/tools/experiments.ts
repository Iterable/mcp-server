/**
 * MCP tools for Iterable experiment operations
 */

import type { IterableClient } from "@iterable/api";
import {
  GetExperimentMetricsParamsSchema,
  GetExperimentParamsSchema,
  GetExperimentVariantsParamsSchema,
  ListExperimentsParamsSchema,
} from "@iterable/api";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { createTool } from "../schema-utils.js";

export function createExperimentTools(client: IterableClient): Tool[] {
  return [
    createTool({
      name: "list_experiments",
      description:
        "List experiments with optional filtering by campaign, status, and date range. Supports pagination.",
      schema: ListExperimentsParamsSchema,
      execute: (params) => client.listExperiments(params),
    }),
    createTool({
      name: "get_experiment",
      description:
        "Get detailed information about a specific experiment by ID, including variants summary and constraints",
      schema: GetExperimentParamsSchema,
      execute: (params) => client.getExperiment(params),
    }),
    createTool({
      name: "get_experiment_variants",
      description:
        "Get variant content for an experiment, including subject lines, preheaders, HTML source, and plain text",
      schema: GetExperimentVariantsParamsSchema,
      execute: (params) => client.getExperimentVariants(params),
    }),
    createTool({
      name: "get_experiment_metrics",
      description:
        "Get experiment metrics for A/B testing analysis (currently supports email experiments only)",
      schema: GetExperimentMetricsParamsSchema,
      execute: (params) => client.getExperimentMetrics(params),
    }),
  ];
}
