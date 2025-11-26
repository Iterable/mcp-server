import { promises as fs } from "fs";
import os from "os";
import path from "path";

export function getCursorConfigPath(): string {
  return path.join(os.homedir(), ".cursor", "mcp.json");
}

export function getWindsurfConfigPath(): string {
  return path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json");
}

export function getAntigravityConfigPath(): string {
  return path.join(os.homedir(), ".gemini", "antigravity", "mcp_config.json");
}

export function getClaudeDesktopConfigPath(): string {
  switch (process.platform) {
    case "darwin":
      return path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json"
      );
    case "win32":
      return path.join(
        process.env.APPDATA || "",
        "Claude",
        "claude_desktop_config.json"
      );
    default:
      return path.join(
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
        "Claude",
        "claude_desktop_config.json"
      );
  }
}

export type IterableMcpConfig = {
  type: "stdio";
  command: string;
  args: string[];
  env: Record<string, string>;
};

export async function ensureDir(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
}

export async function readJson(filePath: string): Promise<any> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

export async function writeJsonSecure(
  filePath: string,
  data: any
): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export async function updateToolConfig(
  filePath: string,
  iterableConfig: IterableMcpConfig
): Promise<void> {
  await ensureDir(filePath);
  const existing = await readJson(filePath);
  const updated = {
    ...existing,
    mcpServers: {
      ...existing.mcpServers,
      iterable: iterableConfig,
    },
  };
  await writeJsonSecure(filePath, updated);
}
