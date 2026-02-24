# routemesh-mcp

`routemesh-mcp` is a local stdio MCP server for interacting with RouteMesh as a cross-chain RPC gateway.  
RouteMesh provides a single endpoint for many chains: `https://lb.routeme.sh/rpc/{chain_id}/{api_key}`.
This server also supports automatic failover to `https://lb2.routeme.sh`.

## What It Supports

- `rpc_list_chains` - discover and filter supported chains
- `rpc_call` - generic JSON-RPC escape hatch
- `rpc_get_block` - fetch by number/tag/hash
- `rpc_get_transaction` - fetch transaction by hash
- `rpc_get_transaction_receipt` - fetch receipt by hash
- `rpc_get_logs` - query logs with block/topic filters
- `rpc_get_balance` - native token balance for an address
- `rpc_call_contract` - read-only `eth_call`
- `rpc_estimate_gas` - gas estimation
- `rpc_get_fee_data` - gas price + EIP-1559 hints
- `rpc_trace_transaction` - trace/debug transaction best effort

## Prerequisites

- Node.js 20+
- A RouteMesh API key

## Setup

```bash
npm install
npm run build
```

Copy `.env.example` to `.env` and set your API key:

```bash
cp .env.example .env
```

## Local Run

For local manual execution:

```bash
ROUTEMESH_API_KEY=your_key_here node dist/index.js
```

Or for development:

```bash
ROUTEMESH_API_KEY=your_key_here npm run dev
```

## Cursor MCP Integration (Command-Based)

Use command-style launch in `~/.cursor/mcp.json` (same model as `mcp-clickhouse` style command entries):

```json
{
  "mcpServers": {
    "routemesh-mcp": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/routemesh-mcp/dist/index.js"],
      "env": {
        "ROUTEMESH_API_KEY": "replace-with-your-routemesh-key"
      }
    }
  }
}
```

This server is not an always-on background daemon. Cursor starts it on demand through the command.

## Development Commands

- `npm run typecheck` - static type checking
- `npm run test` - run tests once
- `npm run test:watch` - watch mode
- `npm run build` - compile to `dist/`

## Notes

- Read-only tools parse and query RouteMesh chain + RPC data.
- The client uses `ROUTEMESH_BASE_URL` first and falls back to `ROUTEMESH_BACKUP_BASE_URL` on retryable failures.
- `rpc_list_chains` parses RouteMesh chain data from `https://routeme.sh/llms.txt`.
- `rpc_call` is included so you can access any additional JSON-RPC method without waiting for tool-specific wrappers.

## References

- RouteMesh overview and chain list: [https://routeme.sh/llms.txt](https://routeme.sh/llms.txt)
- RouteMesh docs: [https://routeme.sh/docs](https://routeme.sh/docs)
