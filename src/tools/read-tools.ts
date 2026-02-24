import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { RoutemeshClient } from "../routemesh/client.js";
import {
  addressSchema,
  chainIdSchema,
  fetchChainsFromLlms,
  formatError,
  formatResult,
  hexStringSchema,
  normalizeBlockTag,
} from "./shared.js";

const topicsSchema = z.array(
  z.union([hexStringSchema, z.array(hexStringSchema), z.null()])
);

const txRequestSchema = z.object({
  from: addressSchema.optional(),
  to: addressSchema.optional(),
  gas: hexStringSchema.optional(),
  gasPrice: hexStringSchema.optional(),
  maxFeePerGas: hexStringSchema.optional(),
  maxPriorityFeePerGas: hexStringSchema.optional(),
  value: hexStringSchema.optional(),
  data: hexStringSchema.optional(),
  nonce: hexStringSchema.optional(),
});

export function registerReadTools(
  server: McpServer,
  client: RoutemeshClient,
  options: { llmsUrl: string; timeoutMs: number }
): void {
  server.registerTool(
    "rpc_list_chains",
    {
      title: "List RouteMesh chains",
      description:
        "Discover supported chains from RouteMesh and filter by chain ID or name query.",
      inputSchema: {
        query: z.string().min(1).optional(),
        chainId: chainIdSchema.optional(),
        limit: z.number().int().min(1).max(500).default(50),
        offset: z.number().int().min(0).default(0),
      },
    },
    async ({ query, chainId, limit, offset }, _extra) => {
      try {
        const chains = await fetchChainsFromLlms(options.llmsUrl, options.timeoutMs);
        let filtered = chains;

        if (chainId) {
          filtered = filtered.filter((chain) => chain.chainId === chainId);
        }

        if (query) {
          const lower = query.toLowerCase();
          filtered = filtered.filter((chain) =>
            `${chain.name} ${chain.chainId}`.toLowerCase().includes(lower)
          );
        }

        const page = filtered.slice(offset, offset + limit);
        return formatResult("RouteMesh chains", {
          total: filtered.length,
          offset,
          limit,
          items: page,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  server.registerTool(
    "rpc_call",
    {
      title: "Raw JSON-RPC call",
      description:
        "Call any JSON-RPC method on a RouteMesh-supported chain. Useful as an escape hatch.",
      inputSchema: {
        chainId: chainIdSchema,
        method: z.string().min(1),
        params: z.array(z.unknown()).default([]),
      },
    },
    async ({ chainId, method, params }, _extra) => {
      try {
        const { result, batchId } = await client.rpcCall(chainId, method, params);
        return formatResult("Raw JSON-RPC result", { chainId, method, result }, batchId);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  server.registerTool(
    "rpc_get_block",
    {
      title: "Get block",
      description:
        "Fetch block data by block number/tag or by block hash on a given chain.",
      inputSchema: {
        chainId: chainIdSchema,
        blockTag: z.string().default("latest"),
        blockHash: hexStringSchema.optional(),
        includeTransactions: z.boolean().default(false),
      },
    },
    async ({ chainId, blockTag, blockHash, includeTransactions }, _extra) => {
      try {
        const method = blockHash ? "eth_getBlockByHash" : "eth_getBlockByNumber";
        const param = blockHash ?? normalizeBlockTag(blockTag);
        const { result: block, batchId } = await client.rpcCall(chainId, method, [
          param,
          includeTransactions,
        ]);
        return formatResult("Block result", { chainId, block }, batchId);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  server.registerTool(
    "rpc_get_transaction",
    {
      title: "Get transaction",
      description: "Fetch a transaction by hash.",
      inputSchema: {
        chainId: chainIdSchema,
        txHash: hexStringSchema,
      },
    },
    async ({ chainId, txHash }, _extra) => {
      try {
        const { result: transaction, batchId } = await client.rpcCall(chainId, "eth_getTransactionByHash", [
          txHash,
        ]);
        return formatResult("Transaction result", { chainId, transaction }, batchId);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  server.registerTool(
    "rpc_get_transaction_receipt",
    {
      title: "Get transaction receipt",
      description: "Fetch a transaction receipt by hash.",
      inputSchema: {
        chainId: chainIdSchema,
        txHash: hexStringSchema,
      },
    },
    async ({ chainId, txHash }, _extra) => {
      try {
        const { result: receipt, batchId } = await client.rpcCall(chainId, "eth_getTransactionReceipt", [
          txHash,
        ]);
        return formatResult("Transaction receipt result", { chainId, receipt }, batchId);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  server.registerTool(
    "rpc_get_logs",
    {
      title: "Get logs",
      description: "Query indexed logs/events with block range and topic filters.",
      inputSchema: {
        chainId: chainIdSchema,
        fromBlock: z.string().default("latest"),
        toBlock: z.string().default("latest"),
        address: z.union([addressSchema, z.array(addressSchema)]).optional(),
        topics: topicsSchema.optional(),
      },
    },
    async ({ chainId, fromBlock, toBlock, address, topics }, _extra) => {
      try {
        const filter = {
          fromBlock: normalizeBlockTag(fromBlock),
          toBlock: normalizeBlockTag(toBlock),
          ...(address ? { address } : {}),
          ...(topics ? { topics } : {}),
        };

        const { result: logs, batchId } = await client.rpcCall(chainId, "eth_getLogs", [filter]);
        return formatResult("Logs result", { chainId, filter, logs }, batchId);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  server.registerTool(
    "rpc_get_balance",
    {
      title: "Get native balance",
      description: "Fetch the native token balance for an address.",
      inputSchema: {
        chainId: chainIdSchema,
        address: addressSchema,
        blockTag: z.string().default("latest"),
      },
    },
    async ({ chainId, address, blockTag }, _extra) => {
      try {
        const { result: balance, batchId } = await client.rpcCall(chainId, "eth_getBalance", [
          address,
          normalizeBlockTag(blockTag),
        ]);
        return formatResult("Balance result", { chainId, address, balance }, batchId);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  server.registerTool(
    "rpc_call_contract",
    {
      title: "Call contract",
      description:
        "Execute a read-only contract call via eth_call using pre-encoded calldata.",
      inputSchema: {
        chainId: chainIdSchema,
        to: addressSchema,
        data: hexStringSchema,
        from: addressSchema.optional(),
        gas: hexStringSchema.optional(),
        gasPrice: hexStringSchema.optional(),
        value: hexStringSchema.optional(),
        blockTag: z.string().default("latest"),
      },
    },
    async (
      { chainId, to, data, from, gas, gasPrice, value, blockTag },
      _extra
    ) => {
      try {
        const tx = {
          to,
          data,
          ...(from ? { from } : {}),
          ...(gas ? { gas } : {}),
          ...(gasPrice ? { gasPrice } : {}),
          ...(value ? { value } : {}),
        };
        const { result, batchId } = await client.rpcCall(chainId, "eth_call", [
          tx,
          normalizeBlockTag(blockTag),
        ]);
        return formatResult("Contract call result", { chainId, tx, result }, batchId);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  server.registerTool(
    "rpc_estimate_gas",
    {
      title: "Estimate gas",
      description: "Estimate gas for a transaction request.",
      inputSchema: {
        chainId: chainIdSchema,
        transaction: txRequestSchema,
      },
    },
    async ({ chainId, transaction }, _extra) => {
      try {
        const { result: gasEstimate, batchId } = await client.rpcCall(chainId, "eth_estimateGas", [
          transaction,
        ]);
        return formatResult("Gas estimate result", {
          chainId,
          transaction,
          gasEstimate,
        }, batchId);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  server.registerTool(
    "rpc_get_fee_data",
    {
      title: "Get fee data",
      description:
        "Fetch current gas price, max priority fee and a one-block fee history sample.",
      inputSchema: {
        chainId: chainIdSchema,
      },
    },
    async ({ chainId }, _extra) => {
      try {
        const [gasPriceResult, maxPriorityFeePerGasResult, feeHistoryResult] = await Promise.all([
          client.rpcCall(chainId, "eth_gasPrice", []),
          client
            .rpcCall(chainId, "eth_maxPriorityFeePerGas", [])
            .catch(() => null),
          client.rpcCall(chainId, "eth_feeHistory", ["0x1", "latest", [50]]),
        ]);

        const gasPrice = gasPriceResult.result;
        const maxPriorityFeePerGas = maxPriorityFeePerGasResult?.result ?? null;
        const feeHistory = feeHistoryResult.result;
        // Use the batchId from the last successful call (feeHistory) or from gasPrice if feeHistory failed
        const batchId = feeHistoryResult.batchId ?? gasPriceResult.batchId;

        return formatResult("Fee data result", {
          chainId,
          gasPrice,
          maxPriorityFeePerGas,
          feeHistory,
        }, batchId);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  server.registerTool(
    "rpc_trace_transaction",
    {
      title: "Trace transaction",
      description:
        "Attempt transaction tracing using trace_transaction or debug_traceTransaction.",
      inputSchema: {
        chainId: chainIdSchema,
        txHash: hexStringSchema,
        traceMethod: z
          .enum(["trace_transaction", "debug_traceTransaction"])
          .default("trace_transaction"),
        allowFallback: z.boolean().default(true),
      },
    },
    async ({ chainId, txHash, traceMethod, allowFallback }, _extra) => {
      try {
        const methods =
          allowFallback && traceMethod === "trace_transaction"
            ? ["trace_transaction", "debug_traceTransaction"]
            : [traceMethod];

        let traceResult: unknown = null;
        let usedMethod = methods[0] ?? traceMethod;
        let lastError: unknown = null;
        let batchId: string | null = null;

        for (const method of methods) {
          try {
            usedMethod = method;
            const response =
              method === "debug_traceTransaction"
                ? await client.rpcCall(chainId, method, [txHash, {}])
                : await client.rpcCall(chainId, method, [txHash]);
            traceResult = response.result;
            batchId = response.batchId;
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
          }
        }

        if (lastError) {
          throw lastError;
        }

        return formatResult("Trace transaction result", {
          chainId,
          txHash,
          usedMethod,
          traceResult,
        }, batchId);
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
