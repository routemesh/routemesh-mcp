import { RoutemeshError } from "./errors.js";

type JsonRpcSuccess<T> = {
  jsonrpc: "2.0";
  id: number;
  result: T;
};

type JsonRpcFailure = {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure;

export type RoutemeshClientConfig = {
  apiKey: string;
  baseUrls: string[];
  timeoutMs: number;
  retryAttempts: number;
};

export class RoutemeshClient {
  private readonly config: RoutemeshClientConfig;
  private nextRequestId = 1;

  constructor(config: RoutemeshClientConfig) {
    this.config = config;
  }

  async rpcCall<T>(
    chainId: number,
    method: string,
    params: unknown[] = []
  ): Promise<{ result: T; batchId?: string | undefined }> {
    const requestId = this.nextRequestId++;
    const endpoints = this.getEndpoints(chainId);

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt += 1) {
      const endpoint = endpoints[attempt % endpoints.length];
      if (!endpoint) {
        throw new RoutemeshError("No RouteMesh endpoints configured", {
          type: "network_error",
        });
      }
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: requestId,
            method,
            params,
          }),
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });

        const batchId = response.headers.get("x-batch-id") ?? undefined;

        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          if (retryable && attempt < this.config.retryAttempts) {
            await this.wait(attempt);
            continue;
          }

          throw new RoutemeshError(
            `RouteMesh HTTP error while calling ${method}`,
            {
              type: "http_error",
              status: response.status,
              details: { endpoint, batchId },
            }
          );
        }

        const payload = (await response.json()) as JsonRpcResponse<T>;

        if (!payload || payload.jsonrpc !== "2.0") {
          throw new RoutemeshError("Invalid JSON-RPC response from RouteMesh", {
            type: "invalid_response",
            details: { payload, batchId },
          });
        }

        if ("error" in payload) {
          throw new RoutemeshError(
            `RouteMesh RPC error for ${method}: ${payload.error.message}`,
            {
              type: "rpc_error",
              details: { ...payload.error, endpoint, batchId },
            }
          );
        }

        return batchId !== undefined
          ? { result: payload.result, batchId }
          : { result: payload.result };
      } catch (error) {
        if (error instanceof RoutemeshError) {
          if (
            (error.type === "http_error" || error.type === "network_error") &&
            attempt < this.config.retryAttempts
          ) {
            await this.wait(attempt);
            continue;
          }

          throw error;
        }

        if (error instanceof Error && error.name === "TimeoutError") {
          if (attempt < this.config.retryAttempts) {
            await this.wait(attempt);
            continue;
          }
          throw new RoutemeshError(
            `RouteMesh request timed out calling ${method}`,
            {
              type: "timeout_error",
              details: { endpoint },
              cause: error,
            }
          );
        }

        if (attempt < this.config.retryAttempts) {
          await this.wait(attempt);
          continue;
        }

        throw new RoutemeshError(
          `Network error while calling ${method} via ${endpoint}`,
          {
            type: "network_error",
            cause: error,
          }
        );
      }
    }

    throw new RoutemeshError("Unexpected retry exit", { type: "network_error" });
  }

  private getEndpoints(chainId: number): string[] {
    const uniqueBaseUrls = [...new Set(this.config.baseUrls)];
    return uniqueBaseUrls.map(
      (baseUrl) => `${baseUrl}/rpc/${chainId}/${this.config.apiKey}`
    );
  }

  private async wait(attempt: number): Promise<void> {
    const delayMs = 200 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
