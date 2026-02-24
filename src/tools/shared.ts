import * as z from "zod/v4";
import { formatToolError } from "../routemesh/errors.js";

export const chainIdSchema = z
  .number()
  .int()
  .positive()
  .describe("EVM chain ID (for example 1 for Ethereum mainnet)");

export const hexStringSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/, "Must be a 0x-prefixed hex string");

export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid EVM address");

export function formatResult(
  title: string,
  payload: unknown,
  batchId?: string | null
) {
  const response: {
    content: Array<{ type: "text"; text: string }>;
    structuredContent: { data: unknown; batchId?: string | null };
  } = {
    content: [
      {
        type: "text" as const,
        text: `${title}\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
    structuredContent: { data: payload as unknown },
  };

  if (batchId !== undefined && batchId !== null) {
    response.structuredContent.batchId = batchId;
  }

  return response;
}

export function formatError(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: `Tool execution failed: ${formatToolError(error)}`,
      },
    ],
  };
}

export function normalizeBlockTag(tag: string): string {
  if (tag === "latest" || tag === "pending" || tag === "earliest") {
    return tag;
  }

  return tag.startsWith("0x") ? tag : `0x${Number(tag).toString(16)}`;
}

export type ChainInfo = {
  chainId: number;
  name: string;
  url: string;
};

export async function fetchChainsFromLlms(
  llmsUrl: string,
  timeoutMs: number
): Promise<ChainInfo[]> {
  const response = await fetch(llmsUrl, {
    method: "GET",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch chain list from ${llmsUrl}`);
  }

  const text = await response.text();
  const lines = text.split("\n");
  const chains: ChainInfo[] = [];
  let currentName: string | null = null;

  for (const line of lines) {
    const chainLine = line.match(/^- (.+?) \(Chain ID: ([0-9]+)\)\s*$/);
    if (chainLine) {
      const name = chainLine[1];
      const chainIdRaw = chainLine[2];
      if (!name || !chainIdRaw) {
        continue;
      }
      currentName = name.trim();
      const chainId = Number.parseInt(chainIdRaw, 10);
      chains.push({
        chainId,
        name: currentName,
        url: "",
      });
      continue;
    }

    const urlLine = line.match(/^  URL:\s*(https?:\/\/\S+)\s*$/);
    if (urlLine && currentName && chains.length > 0) {
      const url = urlLine[1];
      if (!url) {
        continue;
      }
      const lastIndex = chains.length - 1;
      const last = chains[lastIndex];
      if (!last) {
        continue;
      }
      chains[lastIndex] = {
        chainId: last.chainId,
        name: last.name,
        url,
      };
      currentName = null;
    }
  }

  return chains;
}
