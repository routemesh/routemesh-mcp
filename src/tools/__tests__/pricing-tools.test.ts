import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerTools } from "../index.js";

async function connect(mgmtToken: string | null = null) {
  const server = new McpServer({ name: "test", version: "1" });
  registerTools(server, {
    apiKey: "test-key", mgmtToken, apiServerUrl: "https://api.example.test",
    baseUrl: "https://rpc.example.test", backupBaseUrl: "https://backup.example.test",
    timeoutMs: 1000, retryAttempts: 0,
  });
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  return client;
}
afterEach(() => vi.unstubAllGlobals());

describe("public pricing and account tools over MCP", () => {
  it("exposes pricing without exposing customer tools", async () => {
    const client = await connect();
    try {
      const { tools } = await client.listTools();
      expect(tools.map(t => t.name)).toEqual(expect.arrayContaining(["rpc_get_pricing", "rpc_get_ws_pricing"]));
      expect(tools.map(t => t.name)).not.toContain("get_usage");
    } finally { await client.close(); }
  });
  it.each([
    ["rpc_get_pricing", { chainId: 1, method: "eth_call", routingStrategy: "economy" }, "/pricing/rpc?vm=evm&chain_id=1&method=eth_call&routing_strategy=economy", "per_million_requests"],
    ["rpc_get_ws_pricing", { chainId: 8453, subscriptionType: "newHeads" }, "/pricing/ws?chain_id=8453&subscription_type=newHeads", "per_million_notifications"],
  ] as const)("filters %s, labels units, and omits credentials", async (name, args, path, unit) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal("fetch", fetchMock);
    const client = await connect("test-management-token");
    try {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toEqual({ data: { currency: "USD", unit, items: [] } });
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`https://api.example.test${path}`);
      expect(init.headers["x-api-key"]).toBeUndefined();
    } finally { await client.close(); }
  });
  it.each([429, 503])("preserves API error status %s", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status })));
    const client = await connect();
    try {
      const result = await client.callTool({ name: "rpc_get_pricing", arguments: { chainId: 1 } });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain(`status ${status}`);
    } finally { await client.close(); }
  });
  it("rejects invalid and unbounded queries before fetching", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const client = await connect();
    try {
      for (const args of [{}, { chainId: -1 }, { chainId: 1, routingStrategy: "fastest" }]) {
        const result = await client.callTool({ name: "rpc_get_pricing", arguments: args });
        expect(result.isError).toBe(true);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    } finally { await client.close(); }
  });
  it("updates keys by numeric ID without requiring the key secret", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: 42, active: false }));
    vi.stubGlobal("fetch", fetchMock);
    const client = await connect("test-management-token");
    try {
      const result = await client.callTool({ name: "update_api_key", arguments: { id: 42, active: false } });
      expect(result.isError).not.toBe(true);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe("https://api.example.test/api-keys/42");
      expect(init.headers["x-api-key"]).toBe("test-management-token");
      expect(JSON.parse(init.body)).toEqual({ active: false });
    } finally { await client.close(); }
  });
});
