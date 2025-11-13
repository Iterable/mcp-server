/**
 * Consolidated messaging tools for all communication channels
 * Uses factory pattern to eliminate duplication across channels
 */

import type { IterableClient } from "@iterable/api";
import {
  CancelEmailParamsSchema,
  GetChannelsParamsSchema,
  GetEmbeddedMessagesParamsSchema,
  GetInAppMessagesParamsSchema,
  GetMessageTypesParamsSchema,
  SendEmailParamsSchema,
  SendInAppParamsSchema,
  SendPushParamsSchema,
  SendSMSParamsSchema,
  SendWebPushParamsSchema,
  SendWhatsAppParamsSchema,
} from "@iterable/api";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { createTool } from "../schema-utils.js";

// Messaging channel configuration
interface MessagingChannelConfig {
  channel: string;
  displayName: string;
  sendSchema: z.ZodSchema;
  sendMethodName: keyof IterableClient;
  cancelMethodName?: keyof IterableClient;
  hasCancel?: boolean;
}

const MESSAGING_CHANNELS: MessagingChannelConfig[] = [
  {
    channel: "email",
    displayName: "email",
    sendSchema: SendEmailParamsSchema,
    sendMethodName: "sendEmail",
    cancelMethodName: "cancelEmail",
  },
  {
    channel: "sms",
    displayName: "SMS message",
    sendSchema: SendSMSParamsSchema,
    sendMethodName: "sendSMS",
    cancelMethodName: "cancelSMS",
  },
  {
    channel: "whatsapp",
    displayName: "WhatsApp message",
    sendSchema: SendWhatsAppParamsSchema,
    sendMethodName: "sendWhatsApp",
    cancelMethodName: "cancelWhatsApp",
  },
  {
    channel: "web_push",
    displayName: "web push notification",
    sendSchema: SendWebPushParamsSchema,
    sendMethodName: "sendWebPush",
    cancelMethodName: "cancelWebPush",
  },
  {
    channel: "push",
    displayName: "push notification",
    sendSchema: SendPushParamsSchema,
    sendMethodName: "sendPush",
    cancelMethodName: "cancelPush",
  },
  {
    channel: "in_app",
    displayName: "in-app message",
    sendSchema: SendInAppParamsSchema,
    sendMethodName: "sendInApp",
    cancelMethodName: "cancelInApp",
  },
];

function createMessagingToolsForChannel(
  config: MessagingChannelConfig,
  client: IterableClient
): Tool[] {
  const tools: Tool[] = [
    createTool({
      name: `send_${config.channel}`,
      description: `Send ${config.displayName} to user`,
      schema: config.sendSchema,
      execute: (params) => (client as any)[config.sendMethodName](params),
    }),
  ];

  if (config.hasCancel !== false && config.cancelMethodName) {
    tools.push(
      createTool({
        name: `cancel_${config.channel}`,
        description: `Cancel scheduled ${config.displayName} for specific user`,
        schema: CancelEmailParamsSchema, // All cancel operations use the same schema
        execute: (params) => (client as any)[config.cancelMethodName!](params),
      })
    );
  }

  return tools;
}

/**
 * Create all messaging tools using the factory pattern
 */
export function createMessagingTools(client: IterableClient): Tool[] {
  return [
    // Generate tools for all messaging channels
    ...MESSAGING_CHANNELS.flatMap((config) =>
      createMessagingToolsForChannel(config, client)
    ),

    createTool({
      name: "get_channels",
      description:
        "Get all available communication channels (email, SMS, push, etc.)",
      schema: GetChannelsParamsSchema,
      execute: () => client.getChannels(),
    }),
    createTool({
      name: "get_message_types",
      description:
        "Get all message types within the project for use in templates",
      schema: GetMessageTypesParamsSchema,
      execute: () => client.getMessageTypes(),
    }),

    createTool({
      name: "get_in_app_messages",
      description: "Get in-app messages for a user",
      schema: GetInAppMessagesParamsSchema,
      execute: (params) => client.getInAppMessages(params),
    }),

    createTool({
      name: "get_embedded_messages",
      description: "Get embedded messages for a user, grouped by placement ID",
      schema: GetEmbeddedMessagesParamsSchema,
      execute: (params) => client.getEmbeddedMessages(params),
    }),
  ];
}
