import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { ApiServerClient } from "../../api-server/client.js";
import { registerProviderTools } from "../provider-tools.js";

function mockApiServerClient() {
  const upsertProviderNode = vi.fn(async (_input: unknown) => ({
    message: "Node upserted successfully",
    status: "healthy",
    node: { id: 1, plan_id: 120 },
  }));
  const upsertProviderWSNode = vi.fn(async (_input: unknown) => ({
    message: "WebSocket node upserted successfully",
    status: "healthy",
    node_ws: { id: 1, plan_id: 120 },
  }));
  const client = {
    listProviderPlans: vi.fn(async () => []),
    getProviderPlanMethods: vi.fn(async () => []),
    getProviderNodeStatus: vi.fn(async () => ({
      node_id: 1,
      in_sync: true,
      status: "ok",
    })),
    upsertProviderNode,
    upsertProviderWSNode,
    setProviderNodeStatus: vi.fn(async () => ({
      node_id: 1,
      status: "healthy",
    })),
  } as unknown as ApiServerClient;
  return { client, upsertProviderNode, upsertProviderWSNode };
}

async function setup() {
  const {
    client: mockClient,
    upsertProviderNode,
    upsertProviderWSNode,
  } = mockApiServerClient();
  const server = new McpServer({ name: "provider-test", version: "1.0.0" });
  registerProviderTools(server, mockClient);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client(
    { name: "provider-test-client", version: "1.0.0" },
    { capabilities: {} }
  );
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
  return { client, upsertProviderNode, upsertProviderWSNode };
}

async function expectInvalidParams(call: Promise<unknown>) {
  let result: unknown;
  try {
    result = await call;
  } catch (error) {
    // Some SDK versions reject with an InvalidParams McpError instead.
    expect((error as { code?: unknown }).code).toBe(ErrorCode.InvalidParams);
    return;
  }
  const r = result as { isError?: boolean; content?: unknown[] };
  expect(r.isError).toBe(true);
  expect(Array.isArray(r.content) && r.content.length > 0).toBe(true);
}

describe("provider_upsert_node URL validation", () => {
  const validArgs = (url: string) => ({
    plan_id: 120,
    url,
    vm: "evm",
    rate_limit: 100,
    rate_limit_interval_sec: 1,
  });

  it("accepts a public https URL and forwards it to the API server", async () => {
    const { client, upsertProviderNode } = await setup();
    const result = await client.callTool({
      name: "provider_upsert_node",
      arguments: validArgs("https://node.example.com"),
    });
    expect(result.content).toBeDefined();
    expect(upsertProviderNode).toHaveBeenCalledWith({
      plan_id: 120,
      url: "https://node.example.com",
      vm: "evm",
      rate_limit: 100,
      rate_limit_interval_sec: 1,
    });
  });

  it("accepts a public IPv4 literal and an http URL with a port", async () => {
    const { client, upsertProviderNode } = await setup();
    await client.callTool({
      name: "provider_upsert_node",
      arguments: validArgs("http://84.120.5.3:8545"),
    });
    expect(upsertProviderNode).toHaveBeenCalledTimes(1);
  });

  it("accepts a public IPv6 literal", async () => {
    const { client, upsertProviderNode } = await setup();
    await client.callTool({
      name: "provider_upsert_node",
      arguments: validArgs("https://[2606:4700:4700::1111]"),
    });
    expect(upsertProviderNode).toHaveBeenCalledTimes(1);
  });

  it.each([
    "https://127.0.0.1:6379",
    "http://10.0.0.5",
    "http://172.16.0.1",
    "http://172.31.255.254",
    "http://192.168.1.1",
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:8080",
    "https://myhost.localhost",
    "https://[::1]",
    "https://[fc00::1]",
    "https://[fe80::1]",
    "https://[::ffff:127.0.0.1]",
    // IPv4-compatible IPv6 (::/96) embedding non-public IPv4: WHATWG
    // serializes ::127.0.0.1 as ::7f00:1 and ::0.0.127.0 as ::7f00.
    "https://[::7f00:1]:8545",
    "https://[::127.0.0.1]:8545",
    "https://[::0.0.127.0]",
    "https://[::c0a8:101]",
    "https://[::192.168.1.1]",
    "https://[::a9fe:a9fe]",
    "https://[::169.254.169.254]",
    "https://[::a00:1]",
    "https://[::10.0.0.1]",
    // DNS services that resolve hostnames to embedded IP literals.
    "https://127.0.0.1.nip.io",
    "https://192.168.1.1.sslip.io",
    "https://10.0.0.1.xip.io",
    "ftp://node.example.com",
    "file:///etc/passwd",
    "not-a-url",
  ])("rejects blocked or invalid URL %s without invoking the client", async (url) => {
    const { client, upsertProviderNode } = await setup();
    await expectInvalidParams(
      client.callTool({
        name: "provider_upsert_node",
        arguments: validArgs(url),
      })
    );
    expect(upsertProviderNode).not.toHaveBeenCalled();
  });
});

describe("provider_upsert_ws_node URL validation", () => {
  const validArgs = (url: string) => ({
    plan_id: 120,
    chain_id: "137",
    url,
  });

  it("accepts a public wss URL and forwards it to the API server", async () => {
    const { client, upsertProviderWSNode } = await setup();
    const result = await client.callTool({
      name: "provider_upsert_ws_node",
      arguments: validArgs("wss://ws-node.example.com"),
    });
    expect(result.content).toBeDefined();
    expect(upsertProviderWSNode).toHaveBeenCalledWith({
      plan_id: 120,
      chain_id: "137",
      url: "wss://ws-node.example.com",
    });
  });

  it.each([
    "ws://ws.example.com",
    "https://ws.example.com",
    "wss://10.0.0.1",
    "wss://169.254.169.254",
    "wss://[::7f00:1]",
    "wss://[::127.0.0.1]",
    "wss://127.0.0.1.nip.io",
    "wss://localhost",
    "wss://",
  ])("rejects blocked or invalid URL %s without invoking the client", async (url) => {
    const { client, upsertProviderWSNode } = await setup();
    await expectInvalidParams(
      client.callTool({
        name: "provider_upsert_ws_node",
        arguments: validArgs(url),
      })
    );
    expect(upsertProviderWSNode).not.toHaveBeenCalled();
  });
});
