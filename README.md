# RouteMesh MCP Server

`@routemesh/mcp` is a local stdio MCP server for querying blockchain data through RouteMesh.

## At a glance

- Query multiple EVM chains from one MCP server.
- Pull useful on-chain data quickly (blocks, txs, logs, balances, fees).
- Use generic JSON-RPC when you need methods beyond built-in tools.
- Reduce RPC endpoint management overhead with RouteMesh routing + failover.
- Plug into Cursor as an on-demand command, not a background daemon.

## Prompt examples

- "List chains that match `base` and show me their chain IDs."
- "Get the latest block on BSC and summarize timestamp + tx count."
- "Fetch receipt for tx `0x...` on Ethereum and tell me if it succeeded."
- "Get logs for this contract on Arbitrum between block X and Y."
- "Estimate gas for calling this method on Base using these params."
- "Run `eth_getCode` on chain 8453 for address `0x...`."
- "Show my RouteMesh usage for the last 7 days broken down by chain."
- "What is my current RouteMesh balance and request count this month?"

## Tools

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

- `rpc_trace_transaction` - trace/debug transaction best effort
- `get_usage` - customer usage summary and balance from the API server (requires management token)

## Usage reporting

When `ROUTEMESH_MGMT_TOKEN` is set, the server exposes `get_usage`, which calls the API server `GET /usage` endpoint with the customer-scoped management token in the `x-api-key` header.

Create a management token in the RouteMesh dashboard with a route allowlist that includes `GET /usage`.

### `get_usage` query parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | RFC3339 timestamp | Window start (default: now minus 30 days) |
| `to` | RFC3339 timestamp | Window end (default: now UTC) |
| `include` | string array | Sections to return: `summary`, `balance`, `by_chain`, `by_api_key`, `by_api_key_chain`, `top_methods`, `time_series`, `by_scenario` (default: `summary`, `balance`) |
| `groupBy` | string | Flat grouped rows (overrides `include`): `chain`, `api_key`, `api_key,chain`, `method`, `day` |
| `chainId` | string | Filter to one chain |
| `apiKeyId` | positive int | Filter to one customer API key |
| `granularity` | `day` or `hour` | Time series bucketing (default: `day`) |
| `limit` | int (1–100) | Max rows for `top_methods` and `group_by` (default: 20) |

Examples:

- Default (last 30 days, summary + balance): call `get_usage` with no parameters
- Custom window with chain breakdown: `from=2026-06-01T00:00:00Z`, `to=2026-06-18T00:00:00Z`, `include=["summary","by_chain"]`
- Hourly time series for one API key: `include=["time_series"]`, `granularity="hour"`, `apiKeyId=42`
- Top methods on a chain: `include=["top_methods"]`, `chainId="ethereum"`, `limit=10`
- Flat grouped rows: `groupBy="api_key,chain"`, `limit=50`

## Prerequisites

- Node.js 20+
- RouteMesh API key ([sign up](https://routeme.sh/auth/signup))
- Customer management token with `GET /usage` in the route allowlist (optional, for `get_usage`)

## Quick start

Install and build:

```bash
npm install
npm run build
```

Set API key for local dev:

```bash
cp .env.example .env
```

Run local build:

```bash
ROUTEMESH_API_KEY=your_key_here node dist/index.js
```

Run in dev mode:

```bash
ROUTEMESH_API_KEY=your_key_here npm run dev
```

Run published package:

```bash
ROUTEMESH_API_KEY=your_key_here npx -y @routemesh/mcp
```

## Cursor MCP config

Add one of these to `~/.cursor/mcp.json`.

Local build:

```json
{
  "mcpServers": {
    "routemesh": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/PROJECT/dist/index.js"],
      "env": {
        "ROUTEMESH_API_KEY": "replace-with-your-routemesh-key",
        "ROUTEMESH_MGMT_TOKEN": "replace-with-your-customer-mgmt-token"
      }
    }
  }
}
```

Published package via `npx`:

```json
{
  "mcpServers": {
    "routemesh": {
      "command": "npx",
      "args": ["-y", "@routemesh/mcp"],
      "env": {
        "ROUTEMESH_API_KEY": "replace-with-your-routemesh-key",
        "ROUTEMESH_MGMT_TOKEN": "replace-with-your-customer-mgmt-token"
      }
    }
  }
}
```

## Development commands

- `npm run typecheck` - static type checking
- `npm run test` - run tests once
- `npm run test:watch` - watch mode
- `npm run build` - compile to `dist/`

## Release

```bash
npm run test
npm run build
npm version patch
npm publish --access public
```

## Notes

- The server is read-only for on-chain RPC tools.
- `get_usage` reads billing/usage data from the API server; it does not use Atlas.
- Requests use `ROUTEMESH_BASE_URL` first, then `ROUTEMESH_BACKUP_BASE_URL` on retryable failures.
- `rpc_list_chains` parses chain data from `https://routeme.sh/llms.txt`.

## References

- RouteMesh chain list: [https://routeme.sh/llms.txt](https://routeme.sh/llms.txt)
- RouteMesh docs: [https://routeme.sh/docs](https://routeme.sh/docs)
