# RouteMesh MCP Server

`@routemesh/mcp` is a local stdio MCP server that lets AI assistants and other MCP clients talk to **RouteMesh**—an intelligent RPC routing layer for Web3. RouteMesh exposes a single gateway for many chains: `https://lb.routeme.sh/rpc/{chain_id}/{api_key}`, so you can query blocks, transactions, logs, balances, and contract calls across Ethereum, L2s, and other EVM chains without managing per-chain RPC URLs. This server also supports automatic failover to `https://lb2.routeme.sh`.

**To get an API key**, sign up at [https://routeme.sh/auth/signup](https://routeme.sh/auth/signup).

## Use cases

- **Cross-chain discovery** — List supported chains, filter by name or chain ID, then run RPC calls on any of them from one place.
- **On-chain lookup from the assistant** — From a conversation, ask for a wallet’s balance, a transaction receipt, or contract read on a given chain (e.g. “What’s the USDC balance for 0x… on Base?”).
- **Logs and traces** — Query event logs by block range and topics, or fetch best-effort transaction traces for debugging.
- **Gas and fee data** — Get gas prices and EIP-1559 fee data for building or simulating transactions.
- **Generic JSON-RPC** — Use `rpc_call` for any method RouteMesh supports without waiting for a dedicated tool.

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
- A RouteMesh API key ([sign up at routeme.sh/auth/signup](https://routeme.sh/auth/signup))

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

## Run via npx

After publishing, users can run the server directly with:

```bash
ROUTEMESH_API_KEY=your_key_here npx -y @routemesh/mcp
```

## Cursor MCP Integration (Command-Based)

Use command-style launch in `~/.cursor/mcp.json` (same model as `mcp-clickhouse` style command entries).

Local build variant:

```json
{
    "mcpServers": {
        "routemesh": {
            "command": "node",
            "args": ["/ABSOLUTE/PATH/TO/PROJECT/dist/index.js"],
            "env": {
                "ROUTEMESH_API_KEY": "replace-with-your-routemesh-key"
            }
        }
    }
}
```

Published `npx` variant:

```json
{
    "mcpServers": {
        "routemesh": {
            "command": "npx",
      "args": ["-y", "@routemesh/mcp"],
            "env": {
                "ROUTEMESH_API_KEY": "replace-with-your-routemesh-key"
            }
        }
    }
}
```

This server is not an always-on background daemon. Cursor starts it on demand via the command.

## Development Commands

- `npm run typecheck` - static type checking
- `npm run test` - run tests once
- `npm run test:watch` - watch mode
- `npm run build` - compile to `dist/`

## Release workflow

```bash
npm run test
npm run build
npm version patch
npm publish --access public
```

## Notes

- Read-only tools parse and query RouteMesh chain + RPC data.
- The client uses `ROUTEMESH_BASE_URL` first and falls back to `ROUTEMESH_BACKUP_BASE_URL` on retryable failures.
- `rpc_list_chains` parses RouteMesh chain data from `https://routeme.sh/llms.txt`.
- `rpc_call` is included so you can access any additional JSON-RPC method without waiting for tool-specific wrappers.

## References

- RouteMesh overview and chain list: [https://routeme.sh/llms.txt](https://routeme.sh/llms.txt)
- RouteMesh docs: [https://routeme.sh/docs](https://routeme.sh/docs)
