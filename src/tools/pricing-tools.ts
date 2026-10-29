import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ApiServerClient } from "../api-server/client.js";
import { ApiServerError, formatApiServerError } from "../api-server/errors.js";
import { chainIdSchema, formatError, formatResult } from "./shared.js";

function pricingError(error: unknown) {
  if (error instanceof ApiServerError) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: `Tool execution failed: ${formatApiServerError(error)}` }],
    };
  }
  return formatError(error);
}

export function registerPricingTools(server: McpServer, client: ApiServerClient): void {
  server.registerTool(
    "rpc_get_pricing",
    {
      title: "Get RPC service pricing",
      description: "Get current RouteMesh RPC service prices for an EVM chain. Filter by JSON-RPC method and economy/performance routing strategy. Prices are USD per million requests, not blockchain gas fees. Public endpoint; no management token required. These are published route prices, not an account-specific invoice or discount quote. An empty list means no matching price is published; it does not mean free service.",
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        chainId: chainIdSchema,
        method: z.string().min(1).optional().describe("JSON-RPC method, for example eth_call"),
        routingStrategy: z.enum(["economy", "performance"]).optional().describe("Omit to compare both routing strategies"),
      },
    },
    async (params) => {
      try {
        const items = await client.getRpcPricing({
          chainId: params.chainId,
          ...(params.method ? { method: params.method } : {}),
          ...(params.routingStrategy ? { routingStrategy: params.routingStrategy } : {}),
        });
        return formatResult("RPC service pricing", { currency: "USD", unit: "per_million_requests", items });
      } catch (error) {
        return pricingError(error);
      }
    }
  );

  server.registerTool(
    "rpc_get_ws_pricing",
    {
      title: "Get WebSocket notification pricing",
      description: "Get current RouteMesh WebSocket service prices for an EVM chain, optionally filtered by subscription type (for example newHeads or logs). Prices are USD per million notifications, not per request or gas fees. Public endpoint; no management token required. An empty list means no matching price is published; it does not mean free service.",
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        chainId: chainIdSchema,
        subscriptionType: z.string().min(1).optional().describe("Subscription type, for example newHeads or logs"),
      },
    },
    async (params) => {
      try {
        const items = await client.getWsPricing({
          chainId: params.chainId,
          ...(params.subscriptionType ? { subscriptionType: params.subscriptionType } : {}),
        });
        return formatResult("WebSocket notification pricing", { currency: "USD", unit: "per_million_notifications", items });
      } catch (error) {
        return pricingError(error);
      }
    }
  );
}
