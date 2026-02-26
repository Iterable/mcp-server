# Contributing

Thanks for your interest in contributing to the Iterable MCP Server! We welcome bug reports, feature requests, and [pull requests](https://github.com/Iterable/mcp-server/pulls). If you find a bug or have an idea, please [open an issue](https://github.com/Iterable/mcp-server/issues).

## Prerequisites

- Node.js >= 20 (v22 LTS recommended)
- [pnpm](https://pnpm.io/) (see `packageManager` in `package.json` for the exact version)

## Install from source

To test changes locally, clone the repo and use one of the `install-dev` scripts. This builds the project and links it as a local MCP server in your AI client, so you can test your changes without publishing to npm.

```bash
git clone https://github.com/Iterable/mcp-server.git
cd mcp-server
pnpm install-dev:cursor  # or install-dev:claude-desktop, install-dev:claude-code, install-dev:gemini-cli, install-dev:windsurf, install-dev:antigravity
```

To enable debug logging during local development, use the `:debug` variants:

```bash
pnpm install-dev:cursor:debug
```

## Project structure

MCP tools live in `src/tools/`, one file per domain (campaigns, templates, catalogs, etc.). Each file exports a creator function that returns an array of MCP `Tool` definitions. These are registered in `src/tools/index.ts` via the `TOOL_CREATORS_BY_CATEGORY` array, so adding a tool to the appropriate domain file is all that's needed for it to be picked up.

Tool visibility is controlled by `src/tool-filter.ts`, which uses safe-lists to gate tools based on the `ITERABLE_USER_PII`, `ITERABLE_ENABLE_WRITES`, and `ITERABLE_ENABLE_SENDS` permission flags.

### API client

The MCP server uses [`@iterable/api`](https://github.com/Iterable/api-client) as its underlying API client. Tool definitions in this repo map user requests to API client methods. If you need to add support for a new Iterable API endpoint, you'll need to add it to the [api-client](https://github.com/Iterable/api-client) first, then expose it as an MCP tool here.

## Development workflow

```bash
# Install dependencies
pnpm install

# Build the project (runs lint:fix, compiles TypeScript, updates TOOLS.md)
pnpm build

# Build and watch for changes (TypeScript only, does not update TOOLS.md)
pnpm build:watch

# Run in development mode (auto-reloads on file changes)
pnpm dev

# Build and link locally for testing
pnpm run install-dev
```

## Code quality

The build automatically runs `lint:fix`, but you can also run these independently:

```bash
# Run all checks (format, typecheck, lint)
pnpm check

# Auto-format with Prettier
pnpm format

# Auto-fix lint issues with ESLint
pnpm lint:fix
```

## Running tests

The project includes both unit and integration tests:

```bash
# Run all tests
pnpm test

# Run only unit tests (no API key required)
pnpm test:unit

# Run only integration tests (requires valid API key)
pnpm test:integration

# Watch mode
pnpm test:watch
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

## How TOOLS.md stays in sync

`TOOLS.md` is auto-generated. The `scripts/update-tools.js` script reads the tool registry (`TOOL_CREATORS_BY_CATEGORY`) and the permission safe-lists (`tool-filter.ts`) to produce the full tool listing with permission badges. It runs automatically as part of `pnpm build`.

To regenerate it manually:

```bash
pnpm update-tools
```
