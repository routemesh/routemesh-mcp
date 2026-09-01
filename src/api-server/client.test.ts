import { describe, expect, it } from "vitest";
import { ApiServerClient, buildUsageQueryString } from "./client.js";
import { ApiServerError } from "./errors.js";

describe("buildUsageQueryString", () => {
  it("returns an empty string when no params are provided", () => {
    expect(buildUsageQueryString({})).toBe("");
  });

  it("serializes all supported query parameters", () => {
    const query = buildUsageQueryString({
      from: "2026-06-01T00:00:00Z",
      to: "2026-06-18T00:00:00Z",
      include: ["summary", "by_chain"],
      groupBy: "api_key,chain",
      chainId: "ethereum",
      apiKeyId: 42,
      granularity: "hour",
      limit: 10,
    });

    expect(query).toBe(
      "?from=2026-06-01T00%3A00%3A00Z&to=2026-06-18T00%3A00%3A00Z&include=summary%2Cby_chain&group_by=api_key%2Cchain&chain_id=ethereum&api_key_id=42&granularity=hour&limit=10"
    );
  });
});

describe("ApiServerClient", () => {
  it("calls GET /usage with the management token header", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(
        JSON.stringify({
          summary: { requests: 100 },
          balance: { credits: 42 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const client = new ApiServerClient({
        baseUrl: "https://api.routeme.sh",
        mgmtToken: "mgmt-token-123",
        timeoutMs: 1000,
      });

      const usage = await client.getUsage({
        include: ["summary", "balance"],
      });

      expect(usage).toEqual({
        summary: { requests: 100 },
        balance: { credits: 42 },
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe("https://api.routeme.sh/usage?include=summary%2Cbalance");
      expect(calls[0]?.init?.method).toBe("GET");
      expect(
        (calls[0]?.init?.headers as Record<string, string>)["x-api-key"]
      ).toBe("mgmt-token-123");
      expect(
        (calls[0]?.init?.headers as Record<string, string>)["content-type"]
      ).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("calls GET /chains to an unauthenticated endpoint without x-api-key even when mgmtToken is set", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(
        JSON.stringify([
          { chain_id: "1", name: "Ethereum Mainnet" },
          { chain_id: "10", name: "OP Mainnet" },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const client = new ApiServerClient({
        baseUrl: "https://api.routeme.sh",
        mgmtToken: "mgmt-token-123",
        timeoutMs: 1000,
      });

      const chains = await client.getChains();

      expect(chains).toEqual([
        { chain_id: "1", name: "Ethereum Mainnet" },
        { chain_id: "10", name: "OP Mainnet" },
      ]);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe("https://api.routeme.sh/chains");
      expect(calls[0]?.init?.method).toBe("GET");
      expect(
        (calls[0]?.init?.headers as Record<string, string>)["x-api-key"]
      ).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("calls GET /chains to an unauthenticated endpoint without x-api-key when mgmtToken is not set", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(
        JSON.stringify([{ chain_id: "1", name: "Ethereum Mainnet" }]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const client = new ApiServerClient({
        baseUrl: "https://api.routeme.sh",
        timeoutMs: 1000,
      });

      const chains = await client.getChains();

      expect(chains).toEqual([
        { chain_id: "1", name: "Ethereum Mainnet" },
      ]);
      expect(calls).toHaveLength(1);
      expect((calls[0]?.init?.headers as Record<string, string>)[
        "x-api-key"
      ]).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("calls GET /api-keys with auth header and returns array", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(
        JSON.stringify([
          {
            id: 1,
            name: "key-1",
            active: true,
            allowed_domains: ["https://example.com"],
            routing_strategy: "performance",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const client = new ApiServerClient({
        baseUrl: "https://api.routeme.sh",
        mgmtToken: "mgmt-token-123",
        timeoutMs: 1000,
      });

      const keys = await client.listApiKeys();

      expect(keys).toHaveLength(1);
      expect(keys[0]?.id).toBe(1);
      expect(keys[0]?.name).toBe("key-1");
      expect(keys[0]?.active).toBe(true);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe("https://api.routeme.sh/api-keys");
      expect(calls[0]?.init?.method).toBe("GET");
      expect(
        (calls[0]?.init?.headers as Record<string, string>)["x-api-key"]
      ).toBe("mgmt-token-123");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("calls POST /api-keys with correct body and auth for createApiKey", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(
        JSON.stringify({
          id: 42,
          name: "test",
          active: true,
          allowed_domains: ["https://example.com"],
          routing_strategy: "performance",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          api_key: "rm_live_secret123",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const client = new ApiServerClient({
        baseUrl: "https://api.routeme.sh",
        mgmtToken: "mgmt-token-123",
        timeoutMs: 1000,
      });

      const result = await client.createApiKey({
        allowed_domains: ["https://example.com"],
        routing_strategy: "performance",
        name: "test",
      });

      expect(result).toEqual({
        id: 42,
        name: "test",
        active: true,
        allowed_domains: ["https://example.com"],
        routing_strategy: "performance",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        api_key: "rm_live_secret123",
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe("https://api.routeme.sh/api-keys");
      expect(calls[0]?.init?.method).toBe("POST");
      expect(calls[0]?.init?.body).toBe(
        JSON.stringify({
          allowed_domains: ["https://example.com"],
          routing_strategy: "performance",
          name: "test",
        })
      );
      expect(
        (calls[0]?.init?.headers as Record<string, string>)["x-api-key"]
      ).toBe("mgmt-token-123");
      expect(
        (calls[0]?.init?.headers as Record<string, string>)["content-type"]
      ).toBe("application/json");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("calls PUT /api-keys/:apiKey with correct URL encoding for updateApiKey", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(
        JSON.stringify({
          id: 42,
          name: "updated",
          active: false,
          allowed_domains: ["https://example.com"],
          routing_strategy: "economy",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-06-01T00:00:00Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const client = new ApiServerClient({
        baseUrl: "https://api.routeme.sh",
        mgmtToken: "mgmt-token-123",
        timeoutMs: 1000,
      });

      const result = await client.updateApiKey("rm_live_abc/def+ghi", {
        name: "updated",
        active: false,
      });

      expect(result.name).toBe("updated");
      expect(result.active).toBe(false);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe(
        "https://api.routeme.sh/api-keys/rm_live_abc%2Fdef%2Bghi"
      );
      expect(calls[0]?.init?.method).toBe("PUT");
      expect(calls[0]?.init?.body).toBe(
        JSON.stringify({ name: "updated", active: false })
      );
      expect(
        (calls[0]?.init?.headers as Record<string, string>)["x-api-key"]
      ).toBe("mgmt-token-123");
      expect(
        (calls[0]?.init?.headers as Record<string, string>)["content-type"]
      ).toBe("application/json");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("preserves raw error body for non-JSON error responses", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response("<html>Internal Server Error</html>", {
        status: 500,
        headers: { "content-type": "text/html" },
      })) as typeof fetch;

    try {
      const client = new ApiServerClient({
        baseUrl: "https://api.routeme.sh",
        mgmtToken: "mgmt-token-123",
        timeoutMs: 1000,
      });

      await expect(client.getUsage()).rejects.toMatchObject({
        name: "ApiServerError",
        type: "http_error",
        status: 500,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws ApiServerError on non-2xx responses", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    try {
      const client = new ApiServerClient({
        baseUrl: "https://api.routeme.sh",
        mgmtToken: "mgmt-token-123",
        timeoutMs: 1000,
      });

      await expect(client.getUsage()).rejects.toMatchObject({
        name: "ApiServerError",
        status: 403,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws ApiServerError when authenticated method called without mgmtToken", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: "should not reach" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    try {
      const client = new ApiServerClient({
        baseUrl: "https://api.routeme.sh",
        timeoutMs: 1000,
      });

      try {
        await client.listApiKeys();
        throw new Error("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiServerError);
        expect((error as ApiServerError).type).toBe("http_error");
        expect((error as ApiServerError).status).toBe(401);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("ApiServerClient provider-scoped routes", () => {
  function mockFetchOnce(body: unknown, status = 200) {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    return {
      calls,
      restore: () => {
        globalThis.fetch = originalFetch;
      },
    };
  }

  const client = new ApiServerClient({
    baseUrl: "https://api.routeme.sh",
    mgmtToken: "provider-mgmt-token",
    timeoutMs: 1000,
  });

  it("calls GET /provider/plans with the management token header", async () => {
    const plans = [
      {
        id: 120,
        created_at: "2026-01-01T00:00:00Z",
        provider: "acme",
        provider_id: 7,
        name: "acme-base",
        price: 0.01,
        quota: 100,
        quota_unit: "credit",
        description: "",
        overage_price: 0.02,
        overage_limit: 50,
        rate_limit_req: 100,
        rate_limit_req_interval_sec: 1,
        rate_limit_cr: 1000,
        rate_limit_cr_interval_sec: 1,
      },
    ];
    const { calls, restore } = mockFetchOnce(plans);
    try {
      const result = await client.listProviderPlans();
      expect(result).toEqual(plans);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe("https://api.routeme.sh/provider/plans");
      expect(calls[0]?.init?.method).toBe("GET");
      expect(
        (calls[0]?.init?.headers as Record<string, string>)["x-api-key"]
      ).toBe("provider-mgmt-token");
    } finally {
      restore();
    }
  });

  it("calls GET /provider/plans/:planId/methods with the plan id in the path", async () => {
    const methods = [
      {
        id: 1,
        created_at: "2026-01-01T00:00:00Z",
        plan_id: 120,
        method: "eth_blockNumber",
        vm: "evm",
        node_target_type: "evm",
        cost: 1,
        rate_limit: 100,
        rate_limit_interval_sec: 1,
        chain_id: null,
      },
    ];
    const { calls, restore } = mockFetchOnce(methods);
    try {
      const result = await client.getProviderPlanMethods(120);
      expect(result).toEqual(methods);
      expect(calls[0]?.url).toBe(
        "https://api.routeme.sh/provider/plans/120/methods"
      );
      expect(calls[0]?.init?.method).toBe("GET");
      expect(
        (calls[0]?.init?.headers as Record<string, string>)["x-api-key"]
      ).toBe("provider-mgmt-token");
    } finally {
      restore();
    }
  });

  it("calls GET /provider/nodes/:nodeId/status and parses the sync status", async () => {
    const { calls, restore } = mockFetchOnce({
      node_id: 18523,
      in_sync: false,
      status: "out_of_sync",
    });
    try {
      const result = await client.getProviderNodeStatus(18523);
      expect(result).toEqual({
        node_id: 18523,
        in_sync: false,
        status: "out_of_sync",
      });
      expect(calls[0]?.url).toBe(
        "https://api.routeme.sh/provider/nodes/18523/status"
      );
      expect(calls[0]?.init?.method).toBe("GET");
    } finally {
      restore();
    }
  });

  it("calls PUT /provider/nodes with a JSON body and the management token header", async () => {
    const node = {
      id: 55,
      plan_id: 120,
      url: "https://node.example.com",
      vm: "evm",
      chain_id: "1",
      rate_limit: 100,
      rate_limit_interval_sec: 1,
      node_type: "full",
      source: "provider",
      created_at: "2026-01-01T00:00:00Z",
    };
    const { calls, restore } = mockFetchOnce({
      message: "Node upserted successfully",
      node,
      status: "healthy",
    });
    try {
      const result = await client.upsertProviderNode({
        plan_id: 120,
        url: "https://node.example.com",
        vm: "evm",
        rate_limit: 100,
        rate_limit_interval_sec: 1,
      });
      expect(result.node).toEqual(node);
      expect(result.status).toBe("healthy");
      expect(calls[0]?.url).toBe("https://api.routeme.sh/provider/nodes");
      expect(calls[0]?.init?.method).toBe("PUT");
      const init = calls[0]?.init as RequestInit;
      expect(
        (init.headers as Record<string, string>)["x-api-key"]
      ).toBe("provider-mgmt-token");
      expect(
        (init.headers as Record<string, string>)["content-type"]
      ).toBe("application/json");
      expect(JSON.parse(init.body as string)).toEqual({
        plan_id: 120,
        url: "https://node.example.com",
        vm: "evm",
        rate_limit: 100,
        rate_limit_interval_sec: 1,
      });
    } finally {
      restore();
    }
  });

  it("calls PUT /provider/nodes/ws with a JSON body", async () => {
    const nodeWS = {
      id: 56,
      plan_id: 120,
      chain_id: "137",
      url: "wss://ws-node.example.com",
      created_at: "2026-01-01T00:00:00Z",
    };
    const { calls, restore } = mockFetchOnce({
      message: "WebSocket node upserted successfully",
      node_ws: nodeWS,
      status: "healthy",
    });
    try {
      const result = await client.upsertProviderWSNode({
        plan_id: 120,
        chain_id: "137",
        url: "wss://ws-node.example.com",
      });
      expect(result.node_ws).toEqual(nodeWS);
      expect(calls[0]?.url).toBe("https://api.routeme.sh/provider/nodes/ws");
      expect(calls[0]?.init?.method).toBe("PUT");
      expect(JSON.parse((calls[0]?.init as RequestInit).body as string)).toEqual({
        plan_id: 120,
        chain_id: "137",
        url: "wss://ws-node.example.com",
      });
    } finally {
      restore();
    }
  });

  it("calls POST /provider/nodes/status with a JSON body", async () => {
    const { calls, restore } = mockFetchOnce({
      node_id: 55,
      status: "disabled by provider",
    });
    try {
      const result = await client.setProviderNodeStatus({
        node_id: 55,
        status: "disabled by provider",
      });
      expect(result).toEqual({
        node_id: 55,
        status: "disabled by provider",
      });
      expect(calls[0]?.url).toBe("https://api.routeme.sh/provider/nodes/status");
      expect(calls[0]?.init?.method).toBe("POST");
      expect(
        JSON.parse((calls[0]?.init as RequestInit).body as string)
      ).toEqual({ node_id: 55, status: "disabled by provider" });
    } finally {
      restore();
    }
  });

  it("throws ApiServerError with status 403 when the token is not provider-linked", async () => {
    const { restore } = mockFetchOnce({ error: "provider not resolved" }, 403);
    try {
      await expect(client.listProviderPlans()).rejects.toMatchObject({
        name: "ApiServerError",
        status: 403,
      });
    } finally {
      restore();
    }
  });

  it("calls POST /provider/plans/:planId/methods and parses the plain-text success response", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response("Plan methods inserted successfully", {
        status: 201,
        headers: { "content-type": "text/plain" },
      });
    }) as typeof fetch;

    try {
      const methods = [
        {
          method: "eth_blockNumber",
          vm: "evm",
          node_target_type: "evm",
          cost: 1,
          rate_limit: 100,
          rate_limit_interval_sec: 1,
          chain_id: "8453",
        },
      ];
      const result = await client.upsertProviderPlanMethods(120, methods);
      expect(result).toBe("Plan methods inserted successfully");
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe(
        "https://api.routeme.sh/provider/plans/120/methods"
      );
      expect(calls[0]?.init?.method).toBe("POST");
      const init = calls[0]?.init as RequestInit;
      expect(
        (init.headers as Record<string, string>)["x-api-key"]
      ).toBe("provider-mgmt-token");
      expect(
        (init.headers as Record<string, string>)["content-type"]
      ).toBe("application/json");
      expect(JSON.parse(init.body as string)).toEqual({ methods });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
