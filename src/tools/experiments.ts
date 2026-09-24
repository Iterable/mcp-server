/**
 * MCP tools for Iterable experiment operations
 */

import type { IterableClient } from "@iterable/api";
import {
  CopyExperimentVariantParamsSchema,
  CreateExperimentParamsSchema,
  DeclareExperimentWinnerParamsSchema,
  ExperimentIdParamsSchema,
  GetExperimentMetricsParamsSchema,
  GetExperimentParamsSchema,
  GetExperimentTotalsParamsSchema,
  GetExperimentTrendsParamsSchema,
  GetExperimentVariantsParamsSchema,
  ListExperimentsParamsSchema,
  UpdateExperimentSettingsParamsSchema,
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
    createTool({
      name: "get_experiment_totals",
      description:
        "Get lifetime send and conversion totals for a campaign experiment. Holdout is omitted, missing counts are 0, and lift and confidence are not included.",
      schema: GetExperimentTotalsParamsSchema,
      execute: (params) => client.getExperimentTotals(params),
    }),
    createTool({
      name: "get_experiment_trends",
      description:
        "Get the performance time series for a campaign experiment. Provide both startDateTime and endDateTime, or omit both to use the run window. The span is at most 31 days; a longer default window is clipped to the last 31 days.",
      schema: GetExperimentTrendsParamsSchema,
      execute: (params) => client.getExperimentTrends(params),
    }),
    createTool({
      name: "create_experiment",
      description:
        "Create a draft campaign experiment. The campaign template becomes the control.",
      schema: CreateExperimentParamsSchema,
      execute: (params) => client.createExperiment(params),
    }),
    createTool({
      name: "copy_experiment_variant",
      description:
        "Copy a template into a new variant on a draft or ready campaign experiment.",
      schema: CopyExperimentVariantParamsSchema,
      execute: (params) => client.copyExperimentVariant(params),
    }),
    createTool({
      name: "update_experiment_settings",
      description:
        "Update settings on a draft or ready campaign experiment. Omit a field to leave it unchanged.",
      schema: UpdateExperimentSettingsParamsSchema,
      execute: (params) => client.updateExperimentSettings(params),
    }),
    createTool({
      name: "start_experiment",
      description: "Start a draft or ready campaign experiment.",
      schema: ExperimentIdParamsSchema,
      execute: (params) => client.startExperiment(params),
    }),
    createTool({
      name: "cancel_experiment",
      description:
        "Cancel a running or winner_found campaign experiment without declaring a winner.",
      schema: ExperimentIdParamsSchema,
      execute: (params) => client.cancelExperiment(params),
    }),
    createTool({
      name: "declare_experiment_winner",
      description:
        "Declare a winning variant and end a running or winner_found campaign experiment.",
      schema: DeclareExperimentWinnerParamsSchema,
      execute: (params) => client.declareExperimentWinner(params),
    }),
    createTool({
      name: "delete_experiment",
      description: "Delete a draft, ready, or errored campaign experiment.",
      schema: ExperimentIdParamsSchema,
      execute: (params) => client.deleteExperiment(params),
    }),
  ];
}
