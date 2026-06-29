import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

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

const apiKey = process.env.ROUTEMESH_API_KEY;
const customerToken = process.env.CUSTOMER_MGMT_TOKEN ?? process.env.ROUTEMESH_MGMT_TOKEN ?? "";

if (!apiKey) {
  console.log("Skipping MCP verification: ROUTEMESH_API_KEY not set in .env or process.env\n");
  process.exit(0);
}

const env = {
  ...process.env,
  ROUTEMESH_API_KEY: apiKey,
  ROUTEMESH_MGMT_TOKEN: customerToken,
};

// Build the project
console.log("Building project...");
try {
  execSync("npm run build", { stdio: "inherit", cwd: join(__dirname, "..") });
} catch {
  console.log("Build failed — aborting MCP verification\n");
  process.exit(1);
}

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

function parseContent(result: unknown): string {
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  if (Array.isArray(r.content) && r.content.length > 0 && typeof r.content[0] === "object") {
    const c = r.content[0] as Record<string, unknown>;
    if (typeof c.text === "string") return c.text;
  }
  return "";
}

function parseJsonText(text: string): unknown {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

async function run() {
  const transport = new StdioClientTransport({
    command: "node",
    args: [join(__dirname, "..", "dist", "index.js")],
    env: env as Record<string, string>,
  });

  const client = new Client(
    { name: "verify-mcp-tools", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log("MCP connection established\n");

    // List tools
    console.log("Listing tools...");
    const toolsResult = await client.listTools();
    const tools = toolsResult.tools ?? [];
    const toolNames = tools.map((t) => t.name);

    check("tools/list returns a non-empty tool list", () => tools.length > 0);

    if (!customerToken) {
      check("Customer tools are absent when no mgmt token", () =>
        !toolNames.includes("get_usage") &&
        !toolNames.includes("list_api_keys") &&
        !toolNames.includes("create_api_key") &&
        !toolNames.includes("update_api_key")
      );
      check("Read tools are present", () =>
        toolNames.includes("rpc_list_chains")
      );
    } else {
      check("Customer tools are present when mgmt token is set", () =>
        toolNames.includes("get_usage") &&
        toolNames.includes("list_api_keys") &&
        toolNames.includes("create_api_key") &&
        toolNames.includes("update_api_key")
      );
    }

    // Test rpc_list_chains
    console.log("\nTesting rpc_list_chains...");
    const chainsResult = await client.callTool({
      name: "rpc_list_chains",
      arguments: { limit: 5 },
    });
    const chainsText = parseContent(chainsResult);
    const chainsData = parseJsonText(chainsText);
    const chainItems = Array.isArray((chainsData as Record<string, unknown>)?.items)
      ? ((chainsData as Record<string, unknown>).items as unknown[])
      : [];

    check("rpc_list_chains returns non-empty items", () => chainItems.length > 0);
    if (chainItems.length > 0) {
      check("rpc_list_chains items have chain_id and name", () =>
        typeof (chainItems[0] as Record<string, unknown>)?.chain_id === "string" &&
        typeof (chainItems[0] as Record<string, unknown>)?.name === "string"
      );
    }

    // Only test customer tools if mgmt token is available
    if (customerToken) {
      // Test get_usage
      console.log("\nTesting get_usage...");
      const usageResult = await client.callTool({
        name: "get_usage",
        arguments: {},
      });
      const usageText = parseContent(usageResult);
      const usageData = parseJsonText(usageText);

      check("get_usage returns success with usage data", () =>
        usageData !== null && typeof usageData === "object"
      );

      // Test list_api_keys
      console.log("\nTesting list_api_keys...");
      const listResult = await client.callTool({
        name: "list_api_keys",
        arguments: {},
      });
      const listText = parseContent(listResult);
      const listData = parseJsonText(listText);
      const listItems = Array.isArray((listData as Record<string, unknown>)?.items)
        ? ((listData as Record<string, unknown>).items as unknown[])
        : [];

      check("list_api_keys returns array items", () => Array.isArray(listItems));

      // Test create_api_key
      console.log("\nTesting create_api_key...");
      const ts = Date.now();
      const createResult = await client.callTool({
        name: "create_api_key",
        arguments: {
          allowed_domains: ["https://example.com"],
          routing_strategy: "performance",
          name: `mcp-verify-${ts}`,
        },
      });
      const createText = parseContent(createResult);
      const createdData = parseJsonText(createText);

      let apiKeyValue: string | null = null;
      let apiKeyIdValue: number | null = null;
      if (createdData && typeof createdData === "object") {
        const data = createdData as Record<string, unknown>;
        if ("api_key" in data) {
          apiKeyValue = data.api_key as string;
        }
        if ("id" in data) {
          apiKeyIdValue = data.id as number;
        }
      }

      check("create_api_key returns secret api_key value", () =>
        typeof apiKeyValue === "string" && apiKeyValue.length > 0
      );

      // Test update_api_key
      console.log("\nTesting update_api_key...");
      let updateResultKnown = false;
      if (apiKeyValue) {
        const updateResult = await client.callTool({
          name: "update_api_key",
          arguments: {
            apiKey: apiKeyValue,
            name: `mcp-verify-updated-${ts}`,
            active: false,
          },
        });
        const updateText = parseContent(updateResult);
        const updateData = parseJsonText(updateText);

        updateResultKnown =
          typeof updateData === "object" &&
          (updateData as Record<string, unknown>).name === `mcp-verify-updated-${ts}` &&
          (updateData as Record<string, unknown>).active === false;

        check("update_api_key reflects updated name and active:false", () =>
          updateResultKnown
        );
      } else {
        check("update_api_key — skipped (no api_key from create)", () => false);
      }
    }
  } finally {
    await transport.close();
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
