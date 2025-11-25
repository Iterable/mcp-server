/**
 * MCP tools for Iterable template operations
 */

import type { IterableClient } from "@iterable/api";
import {
  BulkDeleteTemplatesParamsSchema,
  GetTemplateByClientIdParamsSchema,
  GetTemplateParamsSchema,
  GetTemplatesParamsSchema,
  PreviewTemplateParamsSchema,
  TemplateProofRequestSchema,
  UpdateEmailTemplateParamsSchema,
  UpdateInAppTemplateParamsSchema,
  UpdatePushTemplateParamsSchema,
  UpdateSMSTemplateParamsSchema,
  UpsertEmailTemplateParamsSchema,
  UpsertInAppTemplateParamsSchema,
  UpsertPushTemplateParamsSchema,
  UpsertSMSTemplateParamsSchema,
} from "@iterable/api";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { createTool } from "../schema-utils.js";

// Template type configuration
interface TemplateTypeConfig {
  type: string;
  displayName: string;
  upsertSchema: z.ZodSchema;
  updateSchema: z.ZodSchema;
  getMethodName: keyof IterableClient;
  upsertMethodName: keyof IterableClient;
  updateMethodName: keyof IterableClient;
  proofMethodName: keyof IterableClient;
  previewMethodName?: keyof IterableClient; // Only email and inapp support preview
  // Special handling for parameter differences
  getParamsTransform?: (params: z.infer<typeof GetTemplateParamsSchema>) => any;
}

const TEMPLATE_TYPES: TemplateTypeConfig[] = [
  {
    type: "email",
    displayName: "email",
    upsertSchema: UpsertEmailTemplateParamsSchema,
    updateSchema: UpdateEmailTemplateParamsSchema,
    getMethodName: "getEmailTemplate",
    upsertMethodName: "upsertEmailTemplate",
    updateMethodName: "updateEmailTemplate",
    proofMethodName: "sendEmailTemplateProof",
    previewMethodName: "previewEmailTemplate",
    getParamsTransform: (params) => params.templateId, // Email uses just templateId
  },
  {
    type: "sms",
    displayName: "SMS",
    upsertSchema: UpsertSMSTemplateParamsSchema,
    updateSchema: UpdateSMSTemplateParamsSchema,
    getMethodName: "getSMSTemplate",
    upsertMethodName: "upsertSMSTemplate",
    updateMethodName: "updateSMSTemplate",
    proofMethodName: "sendSMSTemplateProof",
  },
  {
    type: "push",
    displayName: "push notification",
    upsertSchema: UpsertPushTemplateParamsSchema,
    updateSchema: UpdatePushTemplateParamsSchema,
    getMethodName: "getPushTemplate",
    upsertMethodName: "upsertPushTemplate",
    updateMethodName: "updatePushTemplate",
    proofMethodName: "sendPushTemplateProof",
  },
  {
    type: "inapp",
    displayName: "in-app message",
    upsertSchema: UpsertInAppTemplateParamsSchema,
    updateSchema: UpdateInAppTemplateParamsSchema,
    getMethodName: "getInAppTemplate",
    upsertMethodName: "upsertInAppTemplate",
    updateMethodName: "updateInAppTemplate",
    proofMethodName: "sendInAppTemplateProof",
    previewMethodName: "previewInAppTemplate",
  },
];

function createTemplateToolsForType(
  config: TemplateTypeConfig,
  client: IterableClient
): Tool[] {
  const tools = [
    createTool({
      name: `get_${config.type}_template`,
      description: `Get details for specific ${config.displayName} template by ID`,
      schema: GetTemplateParamsSchema,
      execute: (params) => {
        const methodParams = config.getParamsTransform
          ? config.getParamsTransform(params)
          : params;
        return (client as any)[config.getMethodName](methodParams);
      },
    }),
    createTool({
      name: `upsert_${config.type}_template`,
      description: `Create or update ${config.displayName} template. If a template with the specified clientTemplateId exists, it will be updated; otherwise, a new template will be created.`,
      schema: config.upsertSchema,
      execute: (params) => (client as any)[config.upsertMethodName](params),
    }),
    createTool({
      name: `update_${config.type}_template`,
      description: `Update existing ${config.displayName} template by templateId`,
      schema: config.updateSchema,
      execute: (params) => (client as any)[config.updateMethodName](params),
    }),
    createTool({
      name: `send_${config.type}_template_proof`,
      description: `Send a proof of a ${config.displayName} template to a specific user`,
      schema: TemplateProofRequestSchema,
      execute: (params) => (client as any)[config.proofMethodName](params),
    }),
  ];

  if (config.previewMethodName) {
    tools.push(
      createTool({
        name: `preview_${config.type}_template`,
        description: `Preview ${config.displayName} template with custom data. Returns fully rendered HTML with user, event, and/or data feed data substituted.`,
        schema: PreviewTemplateParamsSchema,
        execute: (params) => (client as any)[config.previewMethodName!](params),
      })
    );
  }

  return tools;
}

export function createTemplateTools(client: IterableClient): Tool[] {
  return [
    // General template tools
    createTool({
      name: "get_templates",
      description: "Retrieve templates",
      schema: GetTemplatesParamsSchema,
      execute: (params) => client.getTemplates(params),
    }),
    createTool({
      name: "get_template_by_client_id",
      description: "Get template by client template ID",
      schema: GetTemplateByClientIdParamsSchema,
      execute: (params) =>
        client.getTemplateByClientId(params.clientTemplateId),
    }),
    createTool({
      name: "delete_templates",
      description: "Delete one or more templates by ID",
      schema: BulkDeleteTemplatesParamsSchema,
      execute: (params) => client.deleteTemplates(params.ids),
    }),

    // Generate tools for all template types using configuration-driven approach
    ...TEMPLATE_TYPES.flatMap((config) =>
      createTemplateToolsForType(config, client)
    ),
  ];
}
