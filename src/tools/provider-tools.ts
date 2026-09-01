import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ApiServerClient } from "../api-server/client.js";
import {
  PROVIDER_NODE_STATUSES,
  type ProviderNodeSource,
} from "../api-server/types.js";
import { ApiServerError, formatApiServerError } from "../api-server/errors.js";
import { formatError, formatResult } from "./shared.js";

const nodeIdSchema = z
  .number()
  .int()
  .positive()
  .describe("RouteMesh node ID (positive int)");

const planIdSchema = z
  .number()
  .int()
  .positive()
  .describe("RouteMesh plan ID (positive int)");

const PROVIDER_TOKEN_NOTE = [
  "Requires a management token configured via ROUTEMESH_MGMT_TOKEN whose",
  "customer is linked to a provider. If the token's customer is not linked to",
  "a provider, the API server returns 403 (provider not resolved). Resources",
  "owned by another provider are reported as 404 (existence is not leaked).",
].join(" ");

function providerErrorResult(error: unknown) {
  if (error instanceof ApiServerError) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: `Tool execution failed: ${formatApiServerError(error)}`,
        },
      ],
    };
  }
  return formatError(error);
}

export function registerProviderTools(
  server: McpServer,
  client: ApiServerClient
): void {
  server.registerTool(
    "provider_list_plans",
    {
      title: "List provider plans",
      description: [
        "List the RPC plans belonging to the authenticated provider from the",
        "RouteMesh API server (GET /provider/plans).",
        PROVIDER_TOKEN_NOTE,
        "Returns an array of plans (id, provider, name, price, quota,",
        "rate limits, billing fields) or an empty array when the provider has",
        "no plans.",
      ].join("\n"),
      inputSchema: {},
    },
    async (_args, _extra) => {
      try {
        const plans = await client.listProviderPlans();
        return formatResult("Provider plans", { items: plans });
      } catch (error) {
        return providerErrorResult(error);
      }
    }
  );

  server.registerTool(
    "provider_get_plan_methods",
    {
      title: "Get provider plan methods",
      description: [
        "Get the RPC methods configured for a plan owned by the authenticated",
        "provider from the RouteMesh API server",
        "(GET /provider/plans/:planId/methods).",
        PROVIDER_TOKEN_NOTE,
        "Returns an array of method rows (method, vm, node_target_type, cost,",
        "rate_limit, rate_limit_interval_sec, chain_id) or an empty array when",
        "the plan has no methods.",
      ].join("\n"),
      inputSchema: {
        planId: planIdSchema,
      },
    },
    async ({ planId }, _extra) => {
      try {
        const methods = await client.getProviderPlanMethods(planId);
        return formatResult(`Provider plan ${planId} methods`, {
          items: methods,
        });
      } catch (error) {
        return providerErrorResult(error);
      }
    }
  );

  server.registerTool(
    "provider_get_node_status",
    {
      title: "Get provider node status",
      description: [
        "Get the synchronization status of a node owned by the authenticated",
        "provider from the RouteMesh API server",
        "(GET /provider/nodes/:nodeId/status).",
        PROVIDER_TOKEN_NOTE,
        "Returns { node_id, in_sync, status } where status is 'ok' or",
        "'out_of_sync'.",
      ].join("\n"),
      inputSchema: {
        nodeId: nodeIdSchema,
      },
    },
    async ({ nodeId }, _extra) => {
      try {
        const status = await client.getProviderNodeStatus(nodeId);
        return formatResult(`Provider node ${nodeId} status`, status);
      } catch (error) {
        return providerErrorResult(error);
      }
    }
  );

  server.registerTool(
    "provider_upsert_node",
    {
      title: "Upsert provider HTTP node",
      description: [
        "Create or update an HTTP RPC node for a plan owned by the",
        "authenticated provider on the RouteMesh API server",
        "(PUT /provider/nodes).",
        PROVIDER_TOKEN_NOTE,
        "The node is screened before persistence; the request fails with 400",
        "when a mandatory screening test does not pass. A URL already",
        "registered to another provider's plan fails with 404; a URL already",
        "registered to a different plan of the same provider fails with 409.",
        "On success the node is set to 'healthy'.",
      ].join("\n"),
      inputSchema: {
        plan_id: planIdSchema.describe(
          "Plan ID the node belongs to (must be owned by the provider)"
        ),
        url: z
          .string()
          .url()
          .describe("HTTP(S) endpoint URL of the node, e.g. https://node.example.com"),
        vm: z
          .string()
          .min(1)
          .describe("Virtual machine type of the node, e.g. 'evm'"),
        rate_limit: z
          .number()
          .min(0)
          .describe("Requests per interval the node supports (0 = unlimited)"),
        rate_limit_interval_sec: z
          .number()
          .int()
          .positive()
          .describe("Rate limit window in seconds"),
        source: z
          .enum(["provider", "website", "erpc", "node_request", "new_chain_request"])
          .optional()
          .describe("Node source (default: 'provider')"),
      },
    },
    async (
      { plan_id, url, vm, rate_limit, rate_limit_interval_sec, source },
      _extra
    ) => {
      try {
        const result = await client.upsertProviderNode({
          plan_id,
          url,
          vm,
          rate_limit,
          rate_limit_interval_sec,
          ...(source !== undefined ? { source } : {}),
        });
        return formatResult("Provider node upsert", result);
      } catch (error) {
        return providerErrorResult(error);
      }
    }
  );

  server.registerTool(
    "provider_upsert_ws_node",
    {
      title: "Upsert provider WebSocket node",
      description: [
        "Create or update a WebSocket node for a plan owned by the",
        "authenticated provider on the RouteMesh API server",
        "(PUT /provider/nodes/ws).",
        PROVIDER_TOKEN_NOTE,
        "The URL must be a wss:// endpoint that accepts eth_subscribe",
        "('newHeads') — the server dials the node to verify before",
        "persisting. A URL already bound to another provider's plan fails",
        "with 409. On success the node is set to 'healthy'.",
      ].join("\n"),
      inputSchema: {
        plan_id: planIdSchema.describe(
          "Plan ID the WebSocket node belongs to (must be owned by the provider)"
        ),
        chain_id: z
          .string()
          .min(1)
          .describe("Chain ID the WebSocket node serves, e.g. '137'"),
        url: z
          .string()
          .min(1)
          .describe("WebSocket endpoint URL, e.g. wss://ws-node.example.com"),
      },
    },
    async ({ plan_id, chain_id, url }, _extra) => {
      try {
        const result = await client.upsertProviderWSNode({
          plan_id,
          chain_id,
          url,
        });
        return formatResult("Provider WebSocket node upsert", result);
      } catch (error) {
        return providerErrorResult(error);
      }
    }
  );

  server.registerTool(
    "provider_set_node_status",
    {
      title: "Set provider node status",
      description: [
        "Enable, disable, or delete (hide) a node owned by the authenticated",
        "provider on the RouteMesh API server (POST /provider/nodes/status).",
        PROVIDER_TOKEN_NOTE,
        "Allowed statuses: 'healthy' (enable), 'disabled by provider'",
        "(disable), 'provider-deleted' (delete / hide from the provider UI).",
        "Other values are rejected with 400.",
      ].join("\n"),
      inputSchema: {
        node_id: nodeIdSchema.describe(
          "ID of the node to update (must belong to a provider-owned plan)"
        ),
        status: z
          .enum(PROVIDER_NODE_STATUSES as unknown as [string, ...string[]])
          .describe(
            "New node status: 'healthy' (enable), 'disabled by provider' (disable), or 'provider-deleted' (delete / hide)"
          ),
      },
    },
    async ({ node_id, status }, _extra) => {
      try {
        const result = await client.setProviderNodeStatus({
          node_id,
          status: status as (typeof PROVIDER_NODE_STATUSES)[number],
        });
        return formatResult("Provider node status update", result);
      } catch (error) {
        return providerErrorResult(error);
      }
    }
  );
}
