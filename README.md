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
- "List my RouteMesh provider plans and the methods on each plan."

## Tools

- `rpc_list_chains` - discover and filter supported chains (via GET /chains on the API server)
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

- `get_usage` - customer usage summary and balance from the API server (requires management token)
- `list_api_keys` - list customer API keys (requires management token)
- `create_api_key` - create a new API key with allowed domains and routing strategy (requires management token)
- `update_api_key` - update an existing API key (requires management token)
- `provider_list_plans` - list the provider's RPC plans (requires provider-linked management token)
- `provider_get_plan_methods` - list the RPC methods of one of the provider's plans (requires provider-linked management token)
- `provider_get_node_status` - sync status of one of the provider's nodes (requires provider-linked management token)
- `provider_upsert_node` - create/update an HTTP node on a provider plan (requires provider-linked management token)
- `provider_upsert_ws_node` - create/update a WebSocket node on a provider plan (requires provider-linked management token)
- `provider_set_node_status` - enable/disable/delete a provider node (requires provider-linked management token)

## Customer tools

When `ROUTEMESH_MGMT_TOKEN` is set, the server exposes customer-scoped tools that call the API server with the management token in the `x-api-key` header.

Create a management token in the RouteMesh dashboard ([Mgmt Tokens page](https://routeme.sh/app/consumer/mgmt-tokens)): click **New Token**, give it a label (e.g. `mcp`), and copy the secret — it is shown only once.

Customer management tokens are scoped automatically to the customer management routes (`GET /usage`, `GET /api-keys`, `POST /api-keys`, `PUT /api-keys/:id`). There is no route allowlist to configure — use a dedicated token for the MCP server so you can revoke it independently.

Provider tools additionally require the token's customer to be linked to a provider; they are then scoped automatically to `/provider/*` routes, and resources owned by another provider come back as 404.

### `get_usage` — usage summary and balance

`get_usage` fetches customer usage data from the API server (GET /usage).

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

### `list_api_keys` — list API keys

`list_api_keys` calls GET /api-keys and returns an array of API key metadata (id, name, active, allowed_domains, routing_strategy, timestamps). The secret `api_key` value is **never** returned by this endpoint.

### `create_api_key` — create a new API key

`create_api_key` calls POST /api-keys to provision a new key. The request requires:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `allowed_domains` | string[] | yes | Array of allowed domains (valid URLs) |
| `routing_strategy` | `"performance"` or `"economy"` | yes | Routing strategy for this key |
| `name` | string | no | Optional human-readable name |

**Important:** The response includes the secret `api_key` value, which is **only shown once at creation**. Store it securely — it cannot be retrieved again.

### `update_api_key` — update an existing API key

`update_api_key` calls PUT /api-keys/:apiKey for partial updates:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiKey` | string | yes | The API key string to update (from `create_api_key`) |
| `name` | string | no | Updated human-readable name |
| `active` | boolean | no | Activate or deactivate the key |
| `allowed_domains` | string[] | no | Updated array of allowed domains |

At least one of `name`, `active`, or `allowed_domains` must be provided. The secret `api_key` value is **never** returned by this endpoint.

## Provider tools

Provider tools mirror the provider-scoped API routes (`/provider/*`) and require a management token whose customer is linked to a provider. All writes are ownership-checked server-side: a `plan_id` / node that belongs to another provider is rejected (404), so tools can only affect the linked provider's own resources.

### `provider_list_plans` — list the provider's plans

Calls GET /provider/plans. Returns the provider's plans (id, name, price, quota, rate limits, billing fields) or an empty array.

### `provider_get_plan_methods` — list a plan's RPC methods

Calls GET /provider/plans/:planId/methods.

| Parameter | Type | Description |
|-----------|------|-------------|
| `planId` | positive int | Plan owned by the provider (404 otherwise) |

Returns the plan's RPC method rows (method, vm, node_target_type, cost, rate limits, chain_id) or an empty array.

### `provider_get_node_status` — node sync status

Calls GET /provider/nodes/:nodeId/status.

| Parameter | Type | Description |
|-----------|------|-------------|
| `nodeId` | positive int | Node owned by the provider (404 otherwise) |

Returns `{ node_id, in_sync, status }` where `status` is `ok` or `out_of_sync`.

### `provider_upsert_node` — create/update an HTTP node

Calls PUT /provider/nodes. The node is screened server-side; mandatory screening failures are returned as 400. The URL must be a public `http://` or `https://` endpoint; loopback, private (10/8, 172.16/12, 192.168/16), and link-local (169.254/16) addresses are rejected client-side before forwarding.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `plan_id` | positive int | yes | Plan owned by the provider |
| `url` | URL | yes | HTTP(S) endpoint of the node |
| `vm` | string | yes | VM type, e.g. `evm` |
| `rate_limit` | number (>= 0) | yes | Requests the node supports per interval |
| `rate_limit_interval_sec` | positive int | yes | Rate limit window in seconds |
| `source` | enum | no | `provider` (default), `website`, `erpc`, `node_request`, `new_chain_request` |

### `provider_upsert_ws_node` — create/update a WebSocket node

Calls PUT /provider/nodes/ws. The server dials the node and verifies it accepts `eth_subscribe` (`newHeads`) before persisting. The URL must be a public `wss://` endpoint; loopback, private, and link-local addresses are rejected client-side before forwarding.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `plan_id` | positive int | yes | Plan owned by the provider |
| `chain_id` | string | yes | Chain ID served, e.g. `137` |
| `url` | string | yes | `wss://` endpoint of the node |

### `provider_set_node_status` — enable/disable/delete a node

Calls POST /provider/nodes/status.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `node_id` | positive int | yes | Node owned by the provider (404 otherwise) |
| `status` | enum | yes | `healthy` (enable), `disabled by provider` (disable), or `provider-deleted` (delete / hide) |

## Prerequisites

- Node.js 20+
- RouteMesh API key ([sign up](https://routeme.sh/auth/signup))
- Customer management token (optional, for customer tools) — create one on the dashboard's Mgmt Tokens page; it is scoped automatically to the customer management routes

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
- `rpc_list_chains` reads chain data from `GET /chains` on the API server (`ROUTEMESH_API_SERVER_URL`).

## References

- RouteMesh docs: [https://routeme.sh/docs](https://routeme.sh/docs)
