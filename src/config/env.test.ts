import { describe, expect, it } from "vitest";
import { loadConfig } from "./env.js";

describe("loadConfig", () => {
  it("loads defaults when optional env vars are missing", () => {
    const config = loadConfig({
      ROUTEMESH_API_KEY: "test-key",
    });

    expect(config.apiKey).toBe("test-key");
    expect(config.baseUrl).toBe("https://lb.routeme.sh");
    expect(config.backupBaseUrl).toBe("https://lb2.routeme.sh");
    expect(config.timeoutMs).toBe(20_000);
    expect(config.retryAttempts).toBe(2);
    expect(config.llmsUrl).toBe("https://routeme.sh/llms.txt");
  });

  it("throws when ROUTEMESH_API_KEY is missing", () => {
    expect(() => loadConfig({})).toThrow(/ROUTEMESH_API_KEY/);
  });
});
