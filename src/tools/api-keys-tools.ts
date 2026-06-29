import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ApiServerClient } from "../api-server/client.js";
import { ApiServerError, formatApiServerError } from "../api-server/errors.js";
import { formatError, formatResult } from "./shared.js";

const routingStrategySchema = z.enum(["performance", "economy"]);

export function registerApiKeysTools(
  server: McpServer,
  client: ApiServerClient
): void {
  server.registerTool(
    "list_api_keys",
    {
      title: "List API keys",
      description: [
        "List all customer API keys from the RouteMesh API server (GET /api-keys).",
        "Requires a customer-scoped management token configured via ROUTEMESH_MGMT_TOKEN.",
        "Returns key metadata (id, name, active, allowed_domains, routing_strategy, timestamps).",
        "The secret api_key value is never returned by this endpoint.",
      ].join("\n"),
      inputSchema: {},
    },
    async (_args, _extra) => {
      try {
        const keys = await client.listApiKeys();
        return formatResult("Customer API keys", { items: keys });
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

  server.registerTool(
    "create_api_key",
    {
      title: "Create API key",
      description: [
        "Create a new customer API key on the RouteMesh API server (POST /api-keys).",
        "Requires a customer-scoped management token configured via ROUTEMESH_MGMT_TOKEN.",
        "The response includes the secret api_key value — it is only shown once at creation time.",
        "Store the returned api_key securely; it cannot be retrieved again.",
      ].join("\n"),
      inputSchema: {
        allowed_domains: z
          .array(z.string().url())
          .min(1)
          .describe("Array of allowed domains for the API key"),
        routing_strategy: routingStrategySchema.describe(
          "Routing strategy: 'performance' or 'economy'"
        ),
        name: z
          .string()
          .max(100)
          .optional()
          .describe("Optional human-readable name for the API key"),
      },
    },
    async ({ allowed_domains, routing_strategy, name }, _extra) => {
      try {
        const created = await client.createApiKey({
          allowed_domains,
          routing_strategy,
          ...(name ? { name } : {}),
        });
        return formatResult("Created API key", created);
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

  server.registerTool(
    "update_api_key",
    {
      title: "Update API key",
      description: [
        "Update an existing customer API key on the RouteMesh API server (PUT /api-keys/:apiKey).",
        "Requires a customer-scoped management token configured via ROUTEMESH_MGMT_TOKEN.",
        "Supports partial updates — only provided fields are changed.",
        "The secret api_key value is never returned by this endpoint.",
      ].join("\n"),
      inputSchema: {
        apiKey: z.string().min(1).describe("The API key identifier to update"),
        allowed_domains: z
          .array(z.string().url())
          .optional()
          .describe("Updated array of allowed domains"),
        name: z
          .string()
          .max(100)
          .optional()
          .describe("Updated human-readable name"),
        active: z
          .boolean()
          .optional()
          .describe("Activate or deactivate the key"),
      },
    },
    async ({ apiKey, allowed_domains, name, active }, _extra) => {
      try {
        const updateInput: Record<string, unknown> = {};
        if (allowed_domains !== undefined) {
          updateInput.allowed_domains = allowed_domains;
        }
        if (name !== undefined) {
          updateInput.name = name;
        }
        if (active !== undefined) {
          updateInput.active = active;
        }
        const updated = await client.updateApiKey(
          apiKey,
          updateInput as Parameters<typeof client.updateApiKey>[1]
        );
        return formatResult("Updated API key", updated);
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
