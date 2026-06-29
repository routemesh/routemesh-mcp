import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ApiServerClient } from "../api-server/client.js";
import {
  USAGE_GRANULARITY_VALUES,
  USAGE_GROUP_BY_VALUES,
  USAGE_INCLUDE_SECTIONS,
} from "../api-server/types.js";
import { ApiServerError, formatApiServerError } from "../api-server/errors.js";
import { formatError, formatResult } from "./shared.js";

const rfc3339Schema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
    "Must be an RFC3339 timestamp (for example 2026-06-01T00:00:00Z)"
  );

const usageIncludeSchema = z.enum(USAGE_INCLUDE_SECTIONS);
const usageGroupBySchema = z.enum(USAGE_GROUP_BY_VALUES);
const usageGranularitySchema = z.enum(USAGE_GRANULARITY_VALUES);

export function registerUsageTools(server: McpServer, client: ApiServerClient): void {
  server.registerTool(
    "get_usage",
    {
      title: "Get customer usage",
      description: [
        "Fetch customer usage summary and balance from the RouteMesh API server (GET /usage).",
        "Requires a customer-scoped management token configured via ROUTEMESH_MGMT_TOKEN.",
        "",
        "Server defaults (overridable per deployment):",
        "- default_window: 720h (30 days) when from is omitted",
        "- max_window: 2160h (90 days) max span between from and to",
        "- default_limit: 20 when limit is omitted",
        "- max_limit: 100 cap for top_methods and group_by",
        "- default_granularity: day when granularity is omitted",
        "",
        "Query parameters:",
        "- from / to: RFC3339 window (to defaults to now UTC)",
        "- include: summary, balance, by_chain, by_api_key, by_api_key_chain, top_methods, time_series, by_scenario (default: summary,balance)",
        "- group_by: flat grouped rows (overrides include when set) — chain, api_key, api_key,chain, method, day",
        "- chain_id: filter to one chain",
        "- api_key_id: filter to one customer API key (positive int)",
        "- granularity: day or hour for time_series",
        "- limit: max rows for top_methods and group_by (default 20, max 100)",
      ].join("\n"),
      inputSchema: {
        from: rfc3339Schema
          .optional()
          .describe("RFC3339 start timestamp (default: now minus 30 days)"),
        to: rfc3339Schema
          .optional()
          .describe("RFC3339 end timestamp (default: now UTC)"),
        include: z
          .array(usageIncludeSchema)
          .optional()
          .describe(
            "Sections to include (default: summary,balance). Ignored when groupBy is set."
          ),
        groupBy: usageGroupBySchema
          .optional()
          .describe("Return flat grouped rows instead of include sections"),
        chainId: z
          .string()
          .min(1)
          .optional()
          .describe("Filter results to a single chain identifier"),
        apiKeyId: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Filter results to one customer API key ID"),
        granularity: usageGranularitySchema
          .optional()
          .describe("Time series bucketing granularity (default: day)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max rows for top_methods and group_by (default 20, max 100)"),
      },
    },
    async ({ from, to, include, groupBy, chainId, apiKeyId, granularity, limit }, _extra) => {
      try {
        const usage = await client.getUsage({
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(include ? { include } : {}),
          ...(groupBy ? { groupBy } : {}),
          ...(chainId ? { chainId } : {}),
          ...(apiKeyId !== undefined ? { apiKeyId } : {}),
          ...(granularity ? { granularity } : {}),
          ...(limit !== undefined ? { limit } : {}),
        });

        return formatResult("Customer usage", usage);
      } catch (error) {
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
    }
  );
}
