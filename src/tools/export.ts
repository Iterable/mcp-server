/**
 * MCP tools for Iterable data export operations
 */

import type { IterableClient } from "@iterable/api";
import {
  CancelExportJobParamsSchema,
  GetExportFilesParamsSchema,
  GetExportJobsParamsSchema,
  StartExportJobParamsSchema,
} from "@iterable/api";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { createTool } from "../schema-utils.js";

export function createExportTools(client: IterableClient): Tool[] {
  return [
    createTool({
      name: "get_available_export_data_types",
      description:
        "Get the list of all available export data types that can be used with start_export_job. Returns an array of data type names that are supported by the Iterable API.",
      schema: z.object({}),
      execute: async () =>
        StartExportJobParamsSchema.shape.dataTypeName.options,
    }),
    createTool({
      name: "get_export_jobs",
      description:
        "Get a list of recent export jobs for the current project. Jobs can be filtered by state (enqueued, queued, running, completed, failed, cancelled, cancelling).",
      schema: GetExportJobsParamsSchema,
      execute: (params) => client.getExportJobs(params),
    }),
    createTool({
      name: "get_export_files",
      description:
        "Get the job status and download URLs for files from a completed export job. Files are added to the list as the export job runs. Use 'startAfter' parameter to paginate through files. Each file is up to 10MB, with exports limited to 100GB total size.",
      schema: GetExportFilesParamsSchema,
      execute: (params) => client.getExportFiles(params),
    }),
    createTool({
      name: "start_export_job",
      description:
        "Start a data export job that processes as a background job. Use 'get_export_files' to check status and obtain download links. Supports many data types including: email events (emailSend, emailOpen, emailClick, emailBounce, etc.), push events (pushSend, pushOpen, etc.), SMS events (smsSend, smsBounce, etc.), WhatsApp events, in-app message events, user data, purchase events, and more. Additional requests are queued if concurrent limit is reached.",
      schema: StartExportJobParamsSchema,
      execute: (params) => client.startExportJob(params),
    }),
    createTool({
      name: "cancel_export_job",
      description:
        "Cancel a queued or running export job created with 'start_export_job'. Use the jobId returned from the start export endpoint.",
      schema: CancelExportJobParamsSchema,
      execute: (params) => client.cancelExportJob(params),
    }),
  ];
}
