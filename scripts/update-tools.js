import { readFileSync, writeFileSync } from "fs";
import { TOOL_CREATORS_BY_CATEGORY } from "../dist/tools/index.js";
import {
  NON_PII_TOOLS,
  READ_ONLY_TOOLS,
  SEND_TOOLS,
} from "../dist/tool-filter.js";

const TOOLS_FILE = "TOOLS.md";

try {
  const toolsByCategory = TOOL_CREATORS_BY_CATEGORY.map(
    ({ category, creator }) => ({
      category,
      tools: creator({}).sort((a, b) => a.name.localeCompare(b.name)),
    })
  );
  const totalToolCount = toolsByCategory.reduce(
    (acc, { tools }) => acc + tools.length,
    0
  );

  const getToolIcons = (toolName) => {
    let icons = "";
    if (!NON_PII_TOOLS.has(toolName)) icons += "🔒";
    if (!READ_ONLY_TOOLS.has(toolName)) icons += "✏️";
    if (SEND_TOOLS.has(toolName)) icons += "✉️";
    return icons ? ` ${icons}` : "";
  };

  const newContent =
    [
      `# Available Iterable MCP Tools (${totalToolCount} tools)`,
      ``,
      `**Legend:**`,
      `- 🔒 = Requires enabling user PII access`,
      `- ✏️ = Requires enabling writes`,
      `- ✉️ = Requires enabling sends`,
      ``,
      ...toolsByCategory.flatMap(({ category, tools }) => [
        `\n## ${category} (${tools.length} tools)`,
        ...tools.map(
          ({ name, description }) =>
            `- **${name}**${getToolIcons(name)}: ${description}`
        ),
      ]),
    ].join("\n") + "\n";

  const existingContent = (() => {
    try {
      return readFileSync(TOOLS_FILE, "utf8");
    } catch {
      return "";
    }
  })();

  if (newContent !== existingContent) {
    writeFileSync(TOOLS_FILE, newContent);
    console.log(`\n🛠️ Generated ${TOOLS_FILE} with ${totalToolCount} tools`);
  }
} catch (error) {
  console.error(`❌ Error generating ${TOOLS_FILE}:`, error.message);
  process.exit(1);
}
