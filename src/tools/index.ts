import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiServerClient } from "../api-server/client.js";
import type { AppConfig } from "../config/env.js";
import { RoutemeshClient } from "../routemesh/client.js";
import { registerReadTools } from "./read-tools.js";
import { registerUsageTools } from "./usage-tools.js";

export function registerTools(server: McpServer, config: AppConfig): void {
  const client = new RoutemeshClient({
    apiKey: config.apiKey,
    baseUrls: [config.baseUrl, config.backupBaseUrl],
    timeoutMs: config.timeoutMs,
    retryAttempts: config.retryAttempts,
  });

  registerReadTools(server, client, {
    llmsUrl: config.llmsUrl,
    timeoutMs: config.timeoutMs,
  });

  if (config.mgmtToken) {
    const apiServerClient = new ApiServerClient({
      baseUrl: config.apiServerUrl,
      mgmtToken: config.mgmtToken,
      timeoutMs: config.timeoutMs,
    });
    registerUsageTools(server, apiServerClient);
  }
}
