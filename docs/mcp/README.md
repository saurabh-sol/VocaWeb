# IDE MCP Setup (Notion, Figma, Canva)

Connect your **local editor** to the same design platforms Vocaweb uses. This is separate from Vocaweb's server-side MCP during import/build — IDE OAuth runs in your browser inside Cursor or VS Code.

## Cursor

1. Open **Cursor Settings → MCP** (or edit `~/.cursor/mcp.json`).
2. Copy the template from [`cursor-mcp.json`](./cursor-mcp.json) in this folder.
3. Restart Cursor.
4. When prompted, complete OAuth for each provider in the browser.

Recommended: install the **Figma plugin** from the Cursor marketplace for MCP + Agent Skills.

## VS Code

1. Install an MCP-compatible extension (GitHub Copilot MCP or similar).
2. Copy [`vscode-mcp.json`](./vscode-mcp.json) into your VS Code MCP config location.
3. Restart VS Code and authorize each remote server.

## Remote endpoints

| Provider | MCP URL |
|----------|---------|
| Notion | `https://mcp.notion.com/mcp` |
| Figma | `https://mcp.figma.com/mcp` |
| Canva | `https://mcp.canva.com/mcp` |

## Canva CIMD (for Vocaweb server)

If you self-host Vocaweb, publish the CIMD document at:

```
GET https://your-api-host/.well-known/canva-mcp-client.json
```

Set `CANVA_MCP_CLIENT_ID_URL` to that URL, then use **Connect Canva MCP** in Dashboard → Settings → Integrations.

## Environment variables (Vocaweb API)

```bash
INTEGRATIONS_MCP_ENABLED=true
NOTION_MCP_MODE=stdio
FIGMA_MCP_MODE=bridge
CANVA_MCP_CLIENT_ID_URL=https://your-domain/.well-known/canva-mcp-client.json
CANVA_MCP_REDIRECT_URI=https://your-api/api/integrations/canva/mcp/callback
MCP_SESSION_TTL_SECONDS=900
```

## Notes

- **IDE tokens ≠ Vocaweb tokens** — connecting in Cursor does not connect your Vocaweb account; use Settings → Integrations for product imports.
- **Figma remote MCP** may require catalog approval; Vocaweb uses a REST bridge until approved.
- **Canva MCP** requires per-user OAuth at `mcp.canva.com` in addition to Canva Connect REST.
