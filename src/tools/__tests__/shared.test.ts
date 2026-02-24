import { describe, expect, it } from "vitest";
import { fetchChainsFromLlms, normalizeBlockTag } from "../shared.js";

describe("normalizeBlockTag", () => {
  it("preserves common symbolic tags", () => {
    expect(normalizeBlockTag("latest")).toBe("latest");
    expect(normalizeBlockTag("pending")).toBe("pending");
    expect(normalizeBlockTag("earliest")).toBe("earliest");
  });

  it("converts decimal values to hex", () => {
    expect(normalizeBlockTag("16")).toBe("0x10");
  });
});

describe("fetchChainsFromLlms", () => {
  it("parses chains from llms text response", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        [
          "- Ethereum Mainnet (Chain ID: 1)",
          "  URL: https://routeme.sh/chain/evm/1-ethereum-mainnet",
          "- OP Mainnet (Chain ID: 10)",
          "  URL: https://routeme.sh/chain/evm/10-op-mainnet",
        ].join("\n"),
        { status: 200 }
      )) as typeof fetch;

    try {
      const chains = await fetchChainsFromLlms("https://example.com/llms.txt", 2000);
      expect(chains).toEqual([
        {
          chainId: 1,
          name: "Ethereum Mainnet",
          url: "https://routeme.sh/chain/evm/1-ethereum-mainnet",
        },
        {
          chainId: 10,
          name: "OP Mainnet",
          url: "https://routeme.sh/chain/evm/10-op-mainnet",
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
