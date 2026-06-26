import { ApiServerError } from "./errors.js";
import type { UsageQueryParams, UsageResponse } from "./types.js";

export type ApiServerClientConfig = {
  baseUrl: string;
  mgmtToken: string;
  timeoutMs: number;
};

export function buildUsageQueryString(params: UsageQueryParams): string {
  const searchParams = new URLSearchParams();

  if (params.from) {
    searchParams.set("from", params.from);
  }
  if (params.to) {
    searchParams.set("to", params.to);
  }
  if (params.include && params.include.length > 0) {
    searchParams.set("include", params.include.join(","));
  }
  if (params.groupBy) {
    searchParams.set("group_by", params.groupBy);
  }
  if (params.chainId) {
    searchParams.set("chain_id", params.chainId);
  }
  if (params.apiKeyId !== undefined) {
    searchParams.set("api_key_id", String(params.apiKeyId));
  }
  if (params.granularity) {
    searchParams.set("granularity", params.granularity);
  }
  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export class ApiServerClient {
  private readonly config: ApiServerClientConfig;

  constructor(config: ApiServerClientConfig) {
    this.config = config;
  }

  async getUsage(params: UsageQueryParams = {}): Promise<UsageResponse> {
    const query = buildUsageQueryString(params);
    const url = `${this.config.baseUrl.replace(/\/$/, "")}/usage${query}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": this.config.mgmtToken,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        const rawDetails = await response.text();
        let details: unknown = rawDetails;
        if (rawDetails) {
          try {
            details = JSON.parse(rawDetails);
          } catch {
            // Keep the raw body for non-JSON error responses.
          }
        }

        throw new ApiServerError("API server HTTP error while fetching usage", {
          type: "http_error",
          status: response.status,
          details,
        });
      }

      try {
        return (await response.json()) as UsageResponse;
      } catch (error) {
        throw new ApiServerError("Invalid JSON response from API server usage endpoint", {
          type: "invalid_response",
          cause: error,
        });
      }
    } catch (error) {
      if (error instanceof ApiServerError) {
        throw error;
      }

      if (error instanceof Error && error.name === "TimeoutError") {
        throw new ApiServerError("API server request timed out while fetching usage", {
          type: "timeout_error",
          cause: error,
        });
      }

      throw new ApiServerError("Network error while fetching usage from API server", {
        type: "network_error",
        cause: error,
      });
    }
  }
}
