#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config/env.js";
import { registerTools } from "./tools/index.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const server = new McpServer({
    name: "routemesh-mcp",
    version: "0.1.0",
  });

  registerTools(server, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(
    `Failed to start routemesh-mcp: ${
      error instanceof Error ? error.message : String(error)
    }\n`
  );
  process.exit(1);
});
