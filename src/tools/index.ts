import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiServerClient } from "../api-server/client.js";
import type { AppConfig } from "../config/env.js";
import { RoutemeshClient } from "../routemesh/client.js";
import { registerReadTools } from "./read-tools.js";
import { registerCustomerTools } from "./customer-tools.js";

export function registerTools(server: McpServer, config: AppConfig): void {
  const client = new RoutemeshClient({
    apiKey: config.apiKey,
    baseUrls: [config.baseUrl, config.backupBaseUrl],
    timeoutMs: config.timeoutMs,
    retryAttempts: config.retryAttempts,
  });

  const apiServerClient = new ApiServerClient({
    baseUrl: config.apiServerUrl,
    ...(config.mgmtToken ? { mgmtToken: config.mgmtToken } : {}),
    timeoutMs: config.timeoutMs,
  });

  registerReadTools(server, client, apiServerClient);

  if (config.mgmtToken) {
    registerCustomerTools(server, apiServerClient);
  }
}
