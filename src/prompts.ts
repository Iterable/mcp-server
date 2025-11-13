/**
 * Auto-generated MCP prompts from existing tools
 * Creates slash commands without code duplication
 */

import type {
  GetPromptResult,
  Prompt,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Convert a tool's JSON Schema to MCP prompt arguments
 */
function toolSchemaToPromptArguments(
  schema: any
): Array<{ name: string; description: string; required: boolean }> {
  if (!schema?.properties) return [];

  const required = schema.required || [];
  return Object.entries(schema.properties).map(
    ([name, prop]: [string, any]) => ({
      name,
      description: prop.description || `${name} parameter`,
      required: required.includes(name),
    })
  );
}

/**
 * Convert tool name to user-friendly prompt name
 * get_user -> get-user, export_data -> export-data
 */
function toolNameToPromptName(toolName: string): string {
  return toolName.replace(/_/g, "-");
}

/**
 * Generate MCP prompts from filtered tools
 * Creates prompts for all provided tools (assumes they're already filtered appropriately)
 */
export function generatePrompts(tools: Tool[]): Prompt[] {
  return tools.map((tool) => ({
    name: toolNameToPromptName(tool.name),
    description: tool.description,
    arguments: toolSchemaToPromptArguments(tool.inputSchema),
  }));
}

/**
 * Generate prompt message that calls the corresponding tool
 */
export function generatePromptMessage(
  promptName: string,
  args: Record<string, unknown> = {}
): GetPromptResult {
  // Convert prompt name back to tool name
  const toolName = promptName.replace(/-/g, "_");

  // Generate a natural language instruction to use the tool
  const argsList = Object.entries(args)
    .filter(([_, value]) => value !== undefined && value !== "")
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `"${key}": "${value}"`;
      }
      return `"${key}": ${JSON.stringify(value)}`;
    });

  const toolCall =
    argsList.length > 0
      ? `${toolName} tool with parameters: { ${argsList.join(", ")} }`
      : `${toolName} tool`;

  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Please use the ${toolCall} to complete this request.`,
        },
      },
    ],
  };
}
