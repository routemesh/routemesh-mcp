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

      const result = await client.updateApiKey("rm_live_abc", {
        name: "updated",
        active: false,
      });

      expect(result.name).toBe("updated");
      expect(result.active).toBe(false);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe(
        "https://api.routeme.sh/api-keys/rm_live_abc"
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

      await expect(client.listApiKeys()).rejects.toMatchObject({
        name: "ApiServerError",
        type: "http_error",
        status: 401,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
