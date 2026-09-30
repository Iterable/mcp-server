import { createIterableError, IterableClient } from "@iterable/api";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

import { createExperimentTools } from "../../src/tools/experiments.js";

const asyncMock = () => jest.fn<(...args: unknown[]) => Promise<unknown>>();

const mockAxiosInstance = {
  get: asyncMock(),
  post: asyncMock(),
  put: asyncMock(),
  delete: asyncMock(),
  patch: asyncMock(),
};

type ToolResult = {
  content: Array<{ type: string; text: string }>;
};

const experiment = {
  id: 884102,
  status: "draft",
  channelType: "email",
  experimentType: "SubjectLine",
  allocationMode: "even_split",
  sizing: {
    holdoutPercentage: null,
    perVariantPercentage: null,
  },
  constraints: null,
  meta: {
    name: "Welcome Experiment",
    conversionMetrics: ["opens"],
    campaignId: 129500,
    projectId: 1,
    orgId: 2,
  },
  variants: [
    {
      id: 0,
      name: "Control",
      value: { templateId: 55 },
      currentPercentage: 50,
      isWinner: false,
      isControl: true,
    },
  ],
};

const totals = {
  id: 884102,
  status: "running",
  variants: [
    {
      id: 0,
      name: "Control",
      isControl: true,
      isWinner: false,
      metrics: { sends: 5000, emailOpen: 1250, purchase: 0 },
    },
  ],
};

function toolHandler(client: IterableClient, name: string) {
  const tool = createExperimentTools(client).find((item) => item.name === name);
  if (!tool || !("handler" in tool) || typeof tool.handler !== "function") {
    throw new Error(`missing tool ${name}`);
  }
  return tool.handler as (args: unknown) => Promise<ToolResult>;
}

function restError(status: number, error: string) {
  return createIterableError({
    response: { status, data: { error } },
    config: { url: "/api/experiments/884102" },
  });
}

async function errorBody(client: IterableClient, name: string, args: unknown) {
  const result = await toolHandler(client, name)(args);
  return JSON.parse(result.content[0]?.text ?? "{}") as {
    statusCode: number;
    rawResponse: { error: string };
  };
}

describe("experiment tools", () => {
  let client: IterableClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new IterableClient(
      {
        apiKey: "test-key",
        baseUrl: "https://api.iterable.com",
        timeout: 30000,
      },
      mockAxiosInstance as never
    );
  });

  it("returns lifetime totals", async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: totals });

    const result = await toolHandler(
      client,
      "get_experiment_totals"
    )({ experimentId: 884102 });

    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      "/api/experiments/884102/totals"
    );
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toEqual(totals);
  });

  it.each([
    { status: 400, error: "Journey experiments are not supported" },
    { status: 404, error: "Experiment 884102 not found" },
  ])("returns totals status $status for $error", async ({ status, error }) => {
    mockAxiosInstance.get.mockRejectedValue(restError(status, error));

    const body = await errorBody(client, "get_experiment_totals", {
      experimentId: 884102,
    });

    expect(body.statusCode).toBe(status);
    expect(body.rawResponse).toEqual({ error });
  });

  it("returns a trends series", async () => {
    const trends = {
      id: 884102,
      status: "running",
      interval: "day",
      startDateTime: "2024-01-01T00:00:00.000Z",
      endDateTime: "2024-01-07T00:00:00.000Z",
      variants: [],
    };
    mockAxiosInstance.get.mockResolvedValue({ data: trends });

    const result = await toolHandler(
      client,
      "get_experiment_trends"
    )({
      experimentId: 884102,
      startDateTime: "2024-01-01T00:00:00.000Z",
      endDateTime: "2024-01-07T00:00:00.000Z",
    });

    expect(JSON.parse(result.content[0]?.text ?? "{}")).toEqual(trends);
  });

  it("rejects a trends request that sets only one datetime", async () => {
    await expect(
      toolHandler(
        client,
        "get_experiment_trends"
      )({
        experimentId: 884102,
        startDateTime: "2024-01-01T00:00:00.000Z",
      })
    ).rejects.toBeInstanceOf(McpError);
    expect(mockAxiosInstance.get).not.toHaveBeenCalled();
  });

  it.each([
    { status: 400, error: "Journey experiments are not supported" },
    { status: 400, error: "Date range cannot exceed 31 days" },
    { status: 400, error: "Date range is outside the experiment run window" },
    { status: 404, error: "Experiment 884102 not found" },
  ])("returns trends status $status for $error", async ({ status, error }) => {
    mockAxiosInstance.get.mockRejectedValue(restError(status, error));

    const body = await errorBody(client, "get_experiment_trends", {
      experimentId: 884102,
    });

    expect(body.statusCode).toBe(status);
    expect(body.rawResponse.error).toBe(error);
  });

  it.each([
    {
      name: "create_experiment",
      method: "post",
      toolArgs: { campaignId: 129500, experimentType: "SubjectLine" },
      url: "/api/experiments",
      body: { campaignId: 129500, experimentType: "SubjectLine" },
    },
    {
      name: "copy_experiment_variant",
      method: "post",
      toolArgs: { experimentId: 884102, copyFromTemplateId: 55 },
      url: "/api/experiments/884102/variants",
      body: { copyFromTemplateId: 55 },
    },
    {
      name: "update_experiment_settings",
      method: "patch",
      toolArgs: { experimentId: 884102, evenlySplitVariations: true },
      url: "/api/experiments/884102/settings",
      body: { evenlySplitVariations: true },
    },
    {
      name: "declare_experiment_winner",
      method: "post",
      toolArgs: { experimentId: 884102, variantId: 2 },
      url: "/api/experiments/884102/winner",
      body: { variantId: 2 },
    },
    {
      name: "start_experiment",
      method: "post",
      toolArgs: { experimentId: 884102 },
      url: "/api/experiments/884102/start",
      body: {},
    },
    {
      name: "cancel_experiment",
      method: "post",
      toolArgs: { experimentId: 884102 },
      url: "/api/experiments/884102/cancel",
      body: {},
    },
    {
      name: "delete_experiment",
      method: "post",
      toolArgs: { experimentId: 884102 },
      url: "/api/experiments/884102/delete",
      body: {},
    },
  ] as const)(
    "$name sends $url",
    async ({ name, method, toolArgs, url, body }) => {
      mockAxiosInstance[method].mockResolvedValue({ data: experiment });

      const result = await toolHandler(client, name)(toolArgs);

      expect(mockAxiosInstance[method]).toHaveBeenCalledWith(url, body);
      expect(JSON.parse(result.content[0]?.text ?? "{}").id).toBe(884102);
    }
  );

  it.each([
    {
      name: "create_experiment",
      method: "post",
      toolArgs: { campaignId: 129500, experimentType: "SubjectLine" },
    },
    {
      name: "copy_experiment_variant",
      method: "post",
      toolArgs: { experimentId: 884102, copyFromTemplateId: 55 },
    },
    {
      name: "update_experiment_settings",
      method: "patch",
      toolArgs: { experimentId: 884102, holdoutSettings: null },
    },
    {
      name: "start_experiment",
      method: "post",
      toolArgs: { experimentId: 884102 },
    },
    {
      name: "cancel_experiment",
      method: "post",
      toolArgs: { experimentId: 884102 },
    },
    {
      name: "declare_experiment_winner",
      method: "post",
      toolArgs: { experimentId: 884102, variantId: 2 },
    },
    {
      name: "delete_experiment",
      method: "post",
      toolArgs: { experimentId: 884102 },
    },
  ] as const)(
    "$name returns 400, 404, and 409",
    async ({ name, method, toolArgs }) => {
      for (const [status, error] of [
        [400, "Journey experiments are not supported"],
        [404, "Experiment 884102 not found"],
        [409, "Experiment cannot be changed in its current status"],
      ] as const) {
        mockAxiosInstance[method].mockRejectedValue(restError(status, error));
        const body = await errorBody(client, name, toolArgs);
        expect(body.statusCode).toBe(status);
        expect(body.rawResponse.error).toBe(error);
      }
    }
  );
});
