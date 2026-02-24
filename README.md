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

## Prerequisites

- Node.js 20+
- RouteMesh API key ([sign up](https://routeme.sh/auth/signup))

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
        "ROUTEMESH_API_KEY": "replace-with-your-routemesh-key"
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
        "ROUTEMESH_API_KEY": "replace-with-your-routemesh-key"
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

- The server is read-only.
- Requests use `ROUTEMESH_BASE_URL` first, then `ROUTEMESH_BACKUP_BASE_URL` on retryable failures.
- `rpc_list_chains` parses chain data from `https://routeme.sh/llms.txt`.

## References

- RouteMesh chain list: [https://routeme.sh/llms.txt](https://routeme.sh/llms.txt)
- RouteMesh docs: [https://routeme.sh/docs](https://routeme.sh/docs)
