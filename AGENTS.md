## Learned User Preferences

- Configure the MCP server as an on-demand command in `.cursor/mcp.json` (like mcp-clickhouse), not as an always-running background daemon.
- Use the `rpc_` tool name prefix; do not use `rm_` or `rmesh_` prefixes.
- Do not include `ROUTEMESH_BASE_URL` or `ROUTEMESH_BACKUP_BASE_URL` in example MCP env config; rely on built-in defaults.
- README should lead with benefits, then prompt examples, then the tool list; avoid large blocks of text.
- When validating MCP changes, launch the server locally and test directly; do not use the installed Cursor routemesh MCP server for development testing.
- Run MCP tools yourself during debugging and verification rather than asking the user to run them.
- Create Linear issues under the m4 milestone in the "api server" project for API server work.

## Learned Workspace Facts

- npm package is `@routemesh/mcp`; CLI entry is `routemesh-mcp`.
- Primary RouteMesh RPC base URL is `https://lb.routeme.sh`; failover is `https://lb2.routeme.sh`.
- Chain discovery uses `GET api.routeme.sh/chains`, not `routeme.sh/llms.txt`.
- Customer-scoped tools call the API server with `ROUTEMESH_MGMT_TOKEN` sent as the `x-api-key` header.
- MCP server is read-only; write/broadcast transaction tools are intentionally excluded.
- RPC tools are exposed with the `rpc_` prefix (e.g. `rpc_get_block`, `rpc_call`).
- Public, RPC, and customer API route definitions live in the sibling repo at `../api/bruno`.
