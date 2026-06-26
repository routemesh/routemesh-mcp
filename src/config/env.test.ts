import { describe, expect, it } from "vitest";
import { loadConfig } from "./env.js";

describe("loadConfig", () => {
  it("loads defaults when optional env vars are missing", () => {
    const config = loadConfig({
      ROUTEMESH_API_KEY: "test-key",
    });

    expect(config.apiKey).toBe("test-key");
    expect(config.mgmtToken).toBeNull();
    expect(config.apiServerUrl).toBe("https://api.routeme.sh");
    expect(config.baseUrl).toBe("https://lb.routeme.sh");
    expect(config.backupBaseUrl).toBe("https://lb2.routeme.sh");
    expect(config.timeoutMs).toBe(20_000);
    expect(config.retryAttempts).toBe(2);
    expect(config.llmsUrl).toBe("https://routeme.sh/llms.txt");
  });

  it("loads management token and api server URL when provided", () => {
    const config = loadConfig({
      ROUTEMESH_API_KEY: "test-key",
      ROUTEMESH_MGMT_TOKEN: "mgmt-token",
      ROUTEMESH_API_SERVER_URL: "https://api.example.test",
    });

    expect(config.mgmtToken).toBe("mgmt-token");
    expect(config.apiServerUrl).toBe("https://api.example.test");
  });

  it("throws when ROUTEMESH_API_KEY is missing", () => {
    expect(() => loadConfig({})).toThrow(/ROUTEMESH_API_KEY/);
  });

  it("rejects whitespace-only ROUTEMESH_MGMT_TOKEN", () => {
    expect(() =>
      loadConfig({
        ROUTEMESH_API_KEY: "test-key",
        ROUTEMESH_MGMT_TOKEN: "   ",
      })
    ).toThrow(/ROUTEMESH_MGMT_TOKEN/);
  });

  it("trims whitespace from ROUTEMESH_MGMT_TOKEN", () => {
    const config = loadConfig({
      ROUTEMESH_API_KEY: "test-key",
      ROUTEMESH_MGMT_TOKEN: "  mgmt-token-123  ",
    });

    expect(config.mgmtToken).toBe("mgmt-token-123");
  });
});
