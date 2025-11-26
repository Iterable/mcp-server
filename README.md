# Iterable MCP Server

[![npm version](https://img.shields.io/npm/v/@iterable/mcp.svg)](https://www.npmjs.com/package/@iterable/mcp)

![Iterable MCP Server](images/iterable-mcp-server.png)

Talk to your Iterable data using natural language. Ask questions or give instructions like *"How many campaigns did we send last week?"*, *"Show me my most recent templates"*, or *"Build me a beautiful email template that does the following..."* and get instant answers without writing code or navigating dashboards.

**Supported AI clients:**
- [Cursor](https://cursor.com/)
- [Claude Desktop](https://www.claude.com/download)
- [Claude Code](https://github.com/anthropics/claude-code)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [Windsurf](https://windsurf.com/)
- [Antigravity by Google](https://antigravity.google/)

## What is MCP?

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) is an open standard that lets AI assistants securely connect to external tools and APIs. This server acts as a bridge between your AI client and Iterable, translating natural language requests into safe API calls.

## Installation

**Prerequisites:**
- Node.js >= 20 (v22 LTS recommended)
- An Iterable API key

```bash
npx @iterable/mcp setup
```

![Iterable MCP Server Setup](images/iterable-mcp-server-setup.gif)


To always use the latest version (auto-update on each restart), add `--auto-update`:

```bash
npx @iterable/mcp setup --auto-update
```

By default, the setup wizard configures the server in a safe, read‑only mode (no PII tools, no writes, no sends). To selectively enable elevated capabilities during setup, pass `--advanced`:

```bash
# Example: enable advanced setup to configure permissions
npx @iterable/mcp setup --advanced
```

What you’ll choose (optional):
- Enable access to user PII (`ITERABLE_USER_PII`)
- Enable writes (create/update/delete actions) (`ITERABLE_ENABLE_WRITES`)
- Enable sends (campaigns/journeys/events) (`ITERABLE_ENABLE_SENDS`) — requires writes

Safety notes:
- Enabling sends requires writes to be enabled.
- Permission settings are saved per key (see key management section below).
- Prompts are generated from read‑only tools for extra safety.

## Prefer a global install?

```bash
pnpm add -g @iterable/mcp
iterable-mcp setup
```

**Note:** The setup command automatically configures the correct command path.

Throughout this guide, commands are shown as `iterable-mcp` for brevity. If not globally installed, use `npx @iterable/mcp` instead (e.g., `npx @iterable/mcp keys list`).

### Install from source

```bash
git clone https://github.com/iterable/mcp-server.git
cd mcp-server
pnpm install-dev:cursor  # or install-dev:claude-desktop, install-dev:claude-code, or install-dev:gemini-cli
```

### Claude Code

The `setup --claude-code` command automatically configures Claude Code by running `claude mcp add` for you.

Alternatively, you can configure it manually:

```bash
# Add your API key first (see API Key Management section below)
iterable-mcp keys add

# Then configure Claude Code
claude mcp add iterable -- npx -y @iterable/mcp

# Verify it was added
claude mcp list

# Optional: Configure privacy settings
claude mcp add iterable \
  --env ITERABLE_USER_PII=false \
  --env ITERABLE_ENABLE_WRITES=false \
  -- npx -y @iterable/mcp
```

If you have already configured Claude Desktop successfully, you can run this command to copy your MCP server settings to Claude Code:

```bash
claude mcp add-from-claude-desktop
```

**Note:** All of the above `claude mcp` commands will save the settings to `~/.claude.json`, which makes the configured MCP servers available across all projects. For shared, project-specific MCP configs, create a `.mcp.json` file in the root of your project.

For more information, see the [Claude Code MCP documentation](https://docs.claude.com/en/docs/claude-code/mcp).

### Manual configuration (Cursor, Claude Desktop, Windsurf, Gemini CLI & Antigravity)

The above commands will automatically configure your AI tool to use the MCP server by editing the appropriate configuration file, but you can also manually edit the appropriate configuration file:
- **Claude Desktop:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Cursor:** `~/.cursor/mcp.json`
- **Windsurf:** `~/.codeium/windsurf/mcp_config.json`
- **Antigravity:** `~/.gemini/antigravity/mcp_config.json`
- **Gemini CLI:** `~/.gemini/settings.json`

All five use the same configuration format:

**Recommended: Using key manager:**
```bash
# First, add your API key (interactive prompts)
iterable-mcp keys add
```

Then edit your config file:
```json
{
  "mcpServers": {
    "iterable": {
      "command": "npx",
      "args": ["-y", "@iterable/mcp"]
    }
  }
}
```

No `env` section needed - API key and base URL are loaded automatically.

**Alternative: Environment variables:**
```json
{
  "mcpServers": {
    "iterable": {
      "command": "npx",
      "args": ["-y", "@iterable/mcp"],
      "env": {
        "ITERABLE_API_KEY": "your-iterable-api-key-here",
        "ITERABLE_BASE_URL": "https://api.iterable.com"
      }
    }
  }
}
```

### Using custom Node/NPX paths

If you need to use a custom path to node or npx (for example, if they are not in your PATH), you can set environment variables before running the setup command:

```bash
# Set custom paths
export ITERABLE_MCP_NODE_PATH="/path/to/custom/node"
export ITERABLE_MCP_NPX_PATH="/path/to/custom/npx"

# Then run setup
npx @iterable/mcp setup --cursor
```

Alternatively, you can manually edit your configuration file (after adding your key):

```json
{
  "mcpServers": {
    "iterable": {
      "command": "/custom/path/to/npx",
      "args": ["-y", "@iterable/mcp"]
    }
  }
}
```

No `env` section is needed if using the key manager.

## What you can do

See [TOOLS.md](TOOLS.md) for all available tools with descriptions. All tools map directly to [Iterable API endpoints](https://api.iterable.com/api/docs).

Try these prompts:
- *"How many campaigns do I have running?"*
- *"Get details on campaign 12345"*
- *"Show me events for user@example.com from the last 30 days"*
- *"Create a campaign called 'Holiday Sale' using template 456"*
- *"What email templates are available?"*
- *"Export all user data from January 2024"*
- *"List users in my 'VIP Customers' list"*
- *"Show me all my product catalogs"*
- *"What journeys are currently active?"*
- *"Send a welcome email to new-user@company.com"*

## Configuration & security

### API Key Management

**Key Storage:**

API keys are stored in the `~/.iterable-mcp/keys.json` file and managed via the `iterable-mcp keys` commands. On macOS the actual API key values are stored in the system Keychain. On Linux, the API key values are stored directly in the file with restricted permissions (0o600). On Windows, the file is protected by default NTFS home directory permissions.

Each key is tied to its API endpoint (US, EU, or custom) and to its permissions (view PII, write operations, send messages).

**How Key Selection Works:**
- You can store multiple API keys with different names (e.g., "production", "staging", "dev")
- Only ONE key is marked as **active** at a time
- The MCP server automatically uses whichever key is currently active
- Your first key is automatically set as active
- Switch between keys using the `activate` command

```bash
# List stored keys (shows which one is active with ● ACTIVE badge)
iterable-mcp keys list

# Add a new key (interactive: prompts for name, region/endpoint, and API key)
# Your first key becomes active automatically
iterable-mcp keys add

# Switch to a different key by name or ID (also switches endpoint)
iterable-mcp keys activate production
iterable-mcp keys activate staging

# Delete a key by ID (requires ID for safety)
# Note: Cannot delete the currently active key - activate another first
iterable-mcp keys delete <key-id>

# To update a key: delete the old one and add a new one with the same name
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ITERABLE_API_KEY` | No* | Your Iterable API key (*Optional if using key manager, otherwise required) |
| `ITERABLE_BASE_URL` | No** | Base URL for the Iterable API (**Not needed when using key manager - URL is stored with each key) |
| `ITERABLE_DEBUG` | No | Set to `true` for API request logging |
| `LOG_LEVEL` | No | Set to `debug` for troubleshooting |
| `ITERABLE_USER_PII` | No | Set to `true` to enable tools that access user PII data (default: `false`) |
| `ITERABLE_ENABLE_WRITES` | No | Set to `true` to enable tools that perform write operations (default: `false`) |
| `ITERABLE_ENABLE_SENDS` | No | Set to `true` to enable tools that can send messages (default: `false`). Requires writes to be enabled |

### Custom endpoints

- The CLI supports selecting the US or EU region, or entering a custom endpoint.
- For security, HTTPS is required for custom endpoints. The only exception is localhost development:
  - Allowed: `http://localhost:3000`, `http://127.0.0.1:8080`, `http://[::1]:4000`
  - Not allowed: plain `http://` on non-local hosts (use `https://` instead)
- When a non-`*.iterable.com` domain is provided, the CLI will ask for confirmation.

## Development

### Running tests

The project includes both unit and integration tests:

```bash
# Run all tests
pnpm test

# Run only unit tests (no API key required)
pnpm test:unit

# Run only integration tests (requires valid API key)
pnpm test:integration
```

### Integration tests

Integration tests make real API calls to Iterable and require a valid API key.

**Setup:**

1. Set your API key as an environment variable:
   ```bash
   export ITERABLE_API_KEY=your_actual_api_key
   ```

2. Or add a key to key manager (interactive):
   ```bash
   iterable-mcp keys add
   ```

   **Note:** The key name can be anything (e.g., "dev", "test", "staging"). The system automatically uses whichever key is marked as **active**. Your first key is automatically set as active. If you have multiple keys, use `iterable-mcp keys activate <name>` to switch between them.

3. Run the integration tests:
   ```bash
   pnpm test:integration
   ```

**Note:** Integration tests require a valid API key (env var or active key manager key). The suite fails fast if none is found.

### Development workflow

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Build and watch for changes
pnpm build:watch

# Run in development mode
pnpm dev

# Install locally for testing
pnpm run install-dev
```

## Troubleshooting

- Claude CLI missing: install `claude` CLI, then re-run `iterable-mcp setup --claude-code`.
- macOS Keychain issues: Ensure Keychain is accessible and re-run setup if needed.

### Client-specific limitations

#### Windsurf (Codeium)

**Tool limit:** Windsurf has a [maximum limit of 100 tools](https://docs.windsurf.com/windsurf/cascade/mcp) that Cascade can access at any given time. When all permissions are enabled (`ITERABLE_USER_PII=true`, `ITERABLE_ENABLE_WRITES=true`, `ITERABLE_ENABLE_SENDS=true`), the Iterable MCP server exposes **104 tools**, which exceeds this limit.

**Workaround:** Use restricted permissions to stay under the 100-tool limit:
- With default permissions (all disabled): 26 tools ✅
- With PII only: 37 tools ✅
- With PII + writes: 86 tools ✅
- With all permissions: 104 tools ❌ (exceeds Windsurf limit)

You can configure permissions when adding a key:
```bash
iterable-mcp keys add --advanced
```

Or update an existing key's permissions:
```bash
iterable-mcp keys update <key-name> --advanced
```

**Process persistence:** After switching API keys with `keys activate`, you must **fully restart Windsurf** (quit and reopen the application). Windsurf keeps MCP server processes running in the background, and they don't automatically reload when you switch keys.

#### Antigravity

**Tool limit:** Antigravity has a maximum limit of 100 tools per MCP server. When all permissions are enabled (`ITERABLE_USER_PII=true`, `ITERABLE_ENABLE_WRITES=true`, `ITERABLE_ENABLE_SENDS=true`), the Iterable MCP server exposes **104 tools**, which exceeds this limit.

**Workaround:** Use restricted permissions to stay under the 100-tool limit:
- With default permissions (all disabled): 26 tools ✅
- With PII only: 37 tools ✅
- With PII + writes: 86 tools ✅
- With all permissions: 104 tools ❌ (exceeds Antigravity limit)

You can configure permissions when adding a key:
```bash
iterable-mcp keys add --advanced
```

Or update an existing key's permissions:
```bash
iterable-mcp keys update <key-name> --advanced
```

## Beta Feature Reminder
Iterable's MCP server is currently in beta. MCP functionality may change, be
suspended, or be discontinued at any time without notice. This software is
provided "as is" and is open source and ready for you to experiment with. For
more information, refer to [Iterable Beta Terms](https://iterable.com/trust/beta-terms/).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
