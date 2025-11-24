import { filterTools } from "../../src/tool-filter.js";
import { createTestConfig } from "../utils/test-config.js";

describe("filterTools defaults", () => {
  const readOnlyTool: any = {
    name: "get_campaigns", // in READ_ONLY_TOOLS
    description: "",
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({}),
  } as any;

  const writeTool: any = {
    name: "create_campaign", // NOT in READ_ONLY_TOOLS
    description: "",
    inputSchema: { type: "object", properties: {} },
    handler: async () => ({}),
  } as any;

  it("excludes write tools when allowWrites=false", () => {
    const out = filterTools(
      [readOnlyTool, writeTool],
      createTestConfig({
        allowUserPii: false,
        allowWrites: false,
        allowSends: true,
      })
    );
    expect(out.map((t) => t.name)).toContain("get_campaigns");
    expect(out.map((t) => t.name)).not.toContain("create_campaign");
  });

  it("includes write tools when allowWrites=true", () => {
    const out = filterTools(
      [readOnlyTool, writeTool],
      createTestConfig({
        allowUserPii: false,
        allowWrites: true,
        allowSends: true,
      })
    );
    expect(out.map((t) => t.name)).toContain("create_campaign");
  });
});
