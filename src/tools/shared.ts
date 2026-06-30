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

