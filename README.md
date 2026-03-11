<div align="center">
  <img
    src="./logo/zerogpu-docs-logo-light.png"
    alt="ZeroGPU Documentation"
    style="width: 100%; max-width: 320px; height: auto; display: inline-block; margin-bottom: 0.5em; margin-top: 0.5em;"
  />
  <div style="display: flex; justify-content: center; gap: 0.5em; flex-wrap: wrap;">
    <a href="https://zerogpu.ai"><strong>Website</strong></a>
    <span>•</span>
    <a href="https://zerogpu.mintlify.app"><strong>Documentation</strong></a>
    <span>•</span>
    <a href="https://github.com/zerogpu"><strong>GitHub</strong></a>
  </div>
</div>

<br/>

This is the **official documentation** repository for [ZeroGPU](https://zerogpu.ai). It contains the API reference, platform guides, cookbook recipes, and SDK examples. The docs are hosted at [zerogpu.mintlify.app](https://zerogpu.mintlify.app).

## Table of contents

- [Connect ZeroGPU docs to AI tools](#connect-zerogpu-docs-to-ai-tools)
  - [What is MCP?](#what-is-mcp)
  - [Connect to Claude Code](#connect-to-claude-code)
  - [Connect to Cursor](#connect-to-cursor)
- [Contributing](#contributing)
  - [Run locally](#run-locally)
  - [Submitting changes](#submitting-changes)
- [License](#license)

---

## Connect ZeroGPU docs to AI tools

### What is MCP?

The [Model Context Protocol (MCP)](https://modelcontextprotocol.io) lets AI applications connect to external data sources in a standard way. Connecting your AI coding tool to ZeroGPU docs via MCP gives it live search over the full documentation. Updates to the docs are reflected automatically.

ZeroGPU docs hosts an MCP server at:

```
https://zerogpu.mintlify.app/mcp
```

### Connect to Claude Code

**Step 1:** Add the MCP server:

```bash
claude mcp add --transport http zerogpu-docs https://zerogpu.mintlify.app/mcp
```

**Step 2:** Verify: run `claude mcp list` and confirm `zerogpu-docs` appears. In a Claude Code session, ask a question about ZeroGPU; answers will be grounded in the docs.

### Connect to Cursor

**Step 1:** Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) → **Open MCP settings**.

**Step 2:** Click **Add custom MCP** and add:

```json
{
  "mcpServers": {
    "zerogpu-docs": {
      "url": "https://zerogpu.mintlify.app/mcp"
    }
  }
}
```

Save, restart Cursor, then ask a question about ZeroGPU in chat to verify.

---

## Contributing

### Run locally

Prerequisites: Node.js.

```bash
npm i -g mint
cd docs
mint dev
```

Preview at `http://localhost:3000` (or the port Mintlify reports).

### Submitting changes

1. Edit `.mdx` or `.md` files in this repo.
2. Run `mint dev` to confirm the site builds.
3. Open a pull request with a clear description.

[Mintlify docs](https://mintlify.com/docs) for configuration and components.

---

## License

[LICENSE](./LICENSE)
