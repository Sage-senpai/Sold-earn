# sold-earn MCP server

Model Context Protocol endpoint at `POST /api/mcp` (Streamable HTTP transport).
Lets any MCP client — Claude Desktop, Cursor, ChatGPT custom GPTs, your own
agents — read the marketplace and (with an API key) submit sales.

## Tools

| Tool | Auth | What it does |
|---|---|---|
| `list_bounties` | open | Active bounties, optional region/productKind filter |
| `get_bounty` | open | One bounty + escrow + verified/pending counts |
| `get_bounty_funnel` | open | Latest Funnel Architect artifact (ICP, channels, message templates) |
| `get_leaderboard` | open | Top scouts by verified-sales for a bounty |
| `get_scout_profile` | open | Scout SBT, region, reputation, applications |
| `submit_sale_proof` | **API key** | Files a pending sale + runs the verifier. Vendor still has to click Verify in the UI to release escrow — this tool never releases funds. |

## Resources

- `sold-earn://bounties/active` — full active list
- `sold-earn://bounty/{id}` — one bounty
- `sold-earn://bounty/{id}/funnel` — funnel artifact

## Auth

- **Reads** are always open.
- **Writes** require `X-MCP-Key: <MCP_API_KEY>` on the HTTP request. If the
  env var is unset, writes are blocked entirely (fail-closed).

## Pointing Claude Desktop at it

Local dev (Next.js dev server on :3001):

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "sold-earn": {
      "transport": "http",
      "url": "http://localhost:3001/api/mcp",
      "headers": {
        "X-MCP-Key": "<paste MCP_API_KEY here if you want write access>"
      }
    }
  }
}
```

Production: swap the URL for your deploy domain + ensure `MCP_API_KEY` is
set in the hosting env.

## Pointing Cursor at it

```jsonc
// .cursor/mcp.json or settings.json mcp.servers
{
  "sold-earn": {
    "url": "http://localhost:3001/api/mcp",
    "headers": { "X-MCP-Key": "..." }
  }
}
```

## Verifying with the Inspector

```bash
npx @modelcontextprotocol/inspector
# Set transport: HTTP
# Set URL:       http://localhost:3001/api/mcp
# Click "Connect" → "List tools" should show 6 tools.
```

## Smoke test by curl

```bash
# initialize
curl -s -X POST http://localhost:3001/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# list tools
curl -s -X POST http://localhost:3001/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# call list_bounties
curl -s -X POST http://localhost:3001/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_bounties","arguments":{"limit":3}}}'
```

## Hard rules

- The MCP server **never holds a key** and **never releases escrow**.
  `submit_sale_proof` writes a pending row + runs the verifier; vendor
  still has to click Verify in the dashboard. This is enforced server-side,
  not in prompts.
- Every write logs an `agent_actions` row with `action: 'verify_sale_via_mcp'`
  so you can audit who submitted what.
- `MCP_API_KEY` should be a long random string. Rotate by changing the env
  var; old keys instantly stop working (single-secret comparison).
