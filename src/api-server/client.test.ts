import { describe, expect, it } from "vitest";
import { ApiServerClient, buildUsageQueryString } from "./client.js";

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
      expect((calls[0]?.init?.headers as Record<string, string>)["x-api-key"]).toBe(
        "mgmt-token-123"
      );
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
});
