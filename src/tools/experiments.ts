/**
 * MCP tools for Iterable experiment operations
 */

import type { IterableClient } from "@iterable/api";
import { GetExperimentMetricsParamsSchema } from "@iterable/api";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { createTool } from "../schema-utils.js";

export function createExperimentTools(client: IterableClient): Tool[] {
  return [
    createTool({
      name: "get_experiment_metrics",
      description:
        "Get experiment metrics for A/B testing analysis (currently supports email experiments only)",
      schema: GetExperimentMetricsParamsSchema,
      execute: (params) => client.getExperimentMetrics(params),
    }),
  ];
}
