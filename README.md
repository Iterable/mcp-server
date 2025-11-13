# Iterable MCP Server

![Iterable MCP Server Setup](images/iterable-mcp-setup.png)


With the new Iterable MCP server, you can now connect Iterable to your favorite AI tools like Cursor, Claude Desktop, and Claude Code!



## What is MCP?

MCP stands for Model Context Protocol. It's a new, open standard that lets AI tools (like Cursor or Claude Desktop) connect to external tools and APIs in a secure, structured way. MCP acts as a "bridge" between your AI app and platforms like Iterable, so you can ask questions or perform actions in plain English, and the AI translates those into safe API calls behind the scenes.

## Installation

**Prerequisites:**
- Node.js >= 20 (v22 LTS recommended)
- An Iterable API key

```bash
npx @iterable/mcp setup
```

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
- View user PII (`ITERABLE_USER_PII`)
- Enable Writes (Create/Update/Delete actions) (`ITERABLE_ENABLE_WRITES`)
- Enable actual sends (`ITERABLE_ENABLE_SENDS`) — requires Writes

Safety notes:
- Sends require Writes to be enabled.
- When you use an existing Keychain key, your choices are saved per key.
- Prompts are generated from read‑only tools for extra safety.

## Prefer a global install?

```bash
pnpm add -g @iterable/mcp
iterable-mcp setup
```

**Note:** The setup command automatically configures the correct command path.

## Install from source

```bash
git clone https://github.com/iterable/mcp-server.git
cd mcp-server
pnpm install-dev:cursor  # or install-dev:claude-desktop or install-dev:claude-code
```

## Claude Code

The `setup --claude-code` command automatically configures Claude Code by running `claude mcp add` for you and stores your API key securely in macOS Keychain.

Alternatively, you can run it manually:

```bash
# Manual installation (alternative to setup --claude-code)
# First, add your API key to the keychain (interactive prompts)
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

## Manual configuration (Cursor & Claude Desktop)

The above commands will automatically configure your AI tool to use the MCP server by editing the appropriate configuration file, but you can also manually edit the appropriate configuration file:
- **Claude Desktop:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Cursor:** `~/.cursor/mcp.json`

**macOS (with Keychain):**
```bash
# First, add your API key to the keychain (interactive prompts)
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

Note: No `env` needed on macOS - API key and base URL are loaded from Keychain.

**Windows/Linux (using environment variables):**
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

Alternatively, you can manually edit your configuration file (after adding your key to the keychain):

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

Note: No `env` needed on macOS — API key and base URL are loaded from Keychain.

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

**macOS Keychain:** API keys are stored securely in Keychain. Each key is tied to its API endpoint (US, EU, or custom).

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

**Windows/Linux:** Use `ITERABLE_API_KEY` and (optionally) `ITERABLE_BASE_URL` env vars.

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ITERABLE_API_KEY` | No* | Your Iterable API key (*Optional on macOS if using Keychain manager, Required on Windows and Linux) |
| `ITERABLE_BASE_URL` | No** | Base URL for the Iterable API (**Not needed on macOS when using key manager - URL is stored with each key) |
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

2. Or on macOS, add a key to the keychain (interactive):
   ```bash
   iterable-mcp keys add
   ```

   **Note:** The key name can be anything (e.g., "dev", "test", "staging"). The system automatically uses whichever key is marked as **active**. Your first key is automatically set as active. If you have multiple keys, use `iterable-mcp keys activate <name>` to switch between them.

3. Run the integration tests:
   ```bash
   pnpm test:integration
   ```

**Note:** Integration tests require a valid API key (env or active macOS Keychain key). The suite fails fast if none is found.

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
- macOS Keychain issues: Ensure Keychain is available; re-run setup. Stale locks are auto‑recovered.


## Beta Feature Reminder
Iterable's MCP server is currently in beta. MCP functionality may change, be
suspended, or be discontinued at any time without notice. This software is
provided "as is" and is open source and ready for you to experiment with. For
more information, refer to [Iterable Beta Terms](https://iterable.com/trust/beta-terms/).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
