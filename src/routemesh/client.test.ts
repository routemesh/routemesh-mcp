import { describe, expect, it } from "vitest";
import { RoutemeshClient } from "./client.js";

describe("RoutemeshClient", () => {
  it("calls the RouteMesh endpoint with chain and API key", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];

    globalThis.fetch = (async (input) => {
      calls.push(String(input));
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: "0x1",
        }),
        { 
          status: 200,
          headers: { "x-batch-id": "test-batch-id-1" }
        }
      );
    }) as typeof fetch;

    try {
      const client = new RoutemeshClient({
        apiKey: "test-key",
        baseUrls: ["https://lb.routeme.sh", "https://lb2.routeme.sh"],
        timeoutMs: 1000,
        retryAttempts: 0,
      });

      const { result, batchId } = await client.rpcCall<string>(1, "eth_blockNumber", []);
      expect(result).toBe("0x1");
      expect(batchId).toBe("test-batch-id-1");
      expect(calls[0]).toBe("https://lb.routeme.sh/rpc/1/test-key");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fails over to backup URL after primary network error", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];

    globalThis.fetch = (async (input) => {
      calls.push(String(input));
      if (calls.length === 1) {
        throw new Error("simulated primary failure");
      }

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: "0x2",
        }),
        { 
          status: 200,
          headers: { "x-batch-id": "test-batch-id-2" }
        }
      );
    }) as typeof fetch;

    try {
      const client = new RoutemeshClient({
        apiKey: "test-key",
        baseUrls: ["https://lb.routeme.sh", "https://lb2.routeme.sh"],
        timeoutMs: 1000,
        retryAttempts: 1,
      });

      const { result, batchId } = await client.rpcCall<string>(1, "eth_blockNumber", []);
      expect(result).toBe("0x2");
      expect(batchId).toBe("test-batch-id-2");
      expect(calls[0]).toBe("https://lb.routeme.sh/rpc/1/test-key");
      expect(calls[1]).toBe("https://lb2.routeme.sh/rpc/1/test-key");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
