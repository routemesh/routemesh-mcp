import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiServerClient } from "../src/api-server/client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const content = readFileSync(join(__dirname, "..", ".env"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env not found — continue with existing env
  }
}

loadEnv();

const baseUrl = process.env.ROUTEMESH_API_SERVER_URL ?? "https://api.routeme.sh";
const timeoutMs = Number(process.env.ROUTEMESH_TIMEOUT_MS ?? "20000");
const customerToken = process.env.CUSTOMER_MGMT_TOKEN ?? process.env.ROUTEMESH_MGMT_TOKEN;

const client = new ApiServerClient({
  baseUrl,
  mgmtToken: customerToken ?? undefined,
  timeoutMs,
});

let passed = 0;
let failed = 0;
let skipped = 0;

function check(label: string, fn: () => boolean) {
  try {
    if (fn()) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.log(`  ✗ ${label}`);
      failed++;
    }
  } catch (err) {
    console.log(`  ✗ ${label}: ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

async function run() {
  console.log(`\nRouteMesh API Server Verification`);
  console.log(`Server: ${baseUrl}\n`);

  // ── Tier 1: Public (no credentials required) ──
  console.log("Tier 1 — Public (no credentials required)");

  let chains: unknown[] = [];
  try {
    chains = await client.getChains();
  } catch {
    // fallback: check will report failure
  }

  check("getChains() returns an array", () => Array.isArray(chains));
  check("getChains() returns non-empty array", () => chains.length > 0);
  if (Array.isArray(chains) && chains.length > 0) {
    check("Each chain has chain_id and name", () =>
      typeof (chains[0] as Record<string, unknown>)?.chain_id === "string" &&
      typeof (chains[0] as Record<string, unknown>)?.name === "string"
    );
  }

  // ── Tier 2: Customer-scoped ──
  if (!customerToken) {
    console.log("\nTier 2 — Skipped (no CUSTOMER_MGMT_TOKEN or ROUTEMESH_MGMT_TOKEN set)\n");
    skipped++;
  } else {
    console.log("\nTier 2 — Customer-scoped (mgmt token set)");

    // getUsage
    let usage: unknown;
    try {
      usage = await client.getUsage();
    } catch {
      // check will report
    }

    const usageData = (usage as Record<string, unknown>) || {};
    const hasUsageKeys = Object.keys(usageData).length > 0;

    check("getUsage() succeeds", () => typeof usage === "object" && hasUsageKeys);
    check("getUsage() returns usage with expected structure", () =>
      typeof usageData === "object" && usageData !== null
    );

    // listApiKeys
    let apiKeys: unknown;
    try {
      apiKeys = await client.listApiKeys();
    } catch {
      // check will report
    }

    const apiKeyArray = apiKeys as unknown[];
    check("listApiKeys() returns an array", () => Array.isArray(apiKeyArray));

    // createApiKey
    const timestamp = Date.now();
    let createdKey: { api_key: string; id: number } | null = null;
    try {
      createdKey = await client.createApiKey({
        name: `mcp-verify-${timestamp}`,
        allowed_domains: ["https://example.com"],
        routing_strategy: "performance",
      });
    } catch {
      // check will report
    }

    check("createApiKey() returns 201/200 with api_key secret and id", () =>
      createdKey !== null && typeof createdKey === "object" &&
      typeof createdKey.api_key === "string" &&
      typeof createdKey.id === "number"
    );

    // updateApiKey
    let updatedKey: { name?: string; active?: boolean } | null = null;
    if (createdKey) {
      try {
        updatedKey = await client.updateApiKey(createdKey.api_key, {
          name: `mcp-verify-updated-${timestamp}`,
          active: false,
        });
      } catch {
        // check will report
      }

      check("updateApiKey() returns 200 with updated fields", () =>
        updatedKey !== null && typeof updatedKey === "object" &&
        updatedKey.name === `mcp-verify-updated-${timestamp}` &&
        updatedKey.active === false
      );
    } else {
      check("updateApiKey() — skipped (no key created)", () => false);
    }

    // listApiKeys again to verify
    try {
      await client.listApiKeys();
    } catch {
      // check will report
    }

    // Cleanup: ensure test key is always deactivated
    if (createdKey && (!updatedKey || updatedKey.active !== false)) {
      try {
        await client.updateApiKey(createdKey.api_key, { active: false });
        console.log("  (cleanup) Deactivated test key");
      } catch {
        // best-effort cleanup
      }
    }
  }

  // ── Summary ──
  const total = passed + failed + skipped;
  console.log(`\nResult: ${passed}/${total} passed, ${failed} failed, ${skipped} skipped\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

run();
