import { ApiServerError } from "./errors.js";
import type {
  CreatedApiKey,
  CreateApiKeyInput,
  CustomerApiKey,
  UpdateApiKeyInput,
  UsageQueryParams,
  UsageResponse,
  ApiChainInfo,
} from "./types.js";

export type ApiServerClientConfig = {
  baseUrl: string;
  mgmtToken?: string;
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

function parseJsonResponse(response: Response): Promise<unknown> {
  return response.json();
}

export class ApiServerClient {
  private readonly config: ApiServerClientConfig;

  constructor(config: ApiServerClientConfig) {
    this.config = config;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: { body?: unknown; authenticated?: boolean }
  ): Promise<T> {
    if (options?.authenticated && !this.config.mgmtToken) {
      throw new ApiServerError(
        "Management token is required for authenticated API server requests",
        {
          type: "http_error",
          status: 401,
        }
      );
    }

    const baseUrl = this.config.baseUrl.replace(/\/$/, "");
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      accept: "application/json",
    };

    if (options?.authenticated && this.config.mgmtToken) {
      headers["x-api-key"] = this.config.mgmtToken;
    }

    if (options?.body !== undefined) {
      headers["content-type"] = "application/json";
    }

    const body: string | undefined = options?.body
      ? JSON.stringify(options.body)
      : undefined;

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    };

    if (body !== undefined) {
      fetchOptions.body = body;
    }

    try {
      const response = await fetch(url, fetchOptions);

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

        throw new ApiServerError("API server HTTP error", {
          type: "http_error",
          status: response.status,
          details,
        });
      }

      try {
        return (await parseJsonResponse(response)) as T;
      } catch (error) {
        throw new ApiServerError("Invalid JSON response from API server", {
          type: "invalid_response",
          cause: error,
        });
      }
    } catch (error) {
      if (error instanceof ApiServerError) {
        throw error;
      }

      if (error instanceof Error && error.name === "TimeoutError") {
        throw new ApiServerError("API server request timed out", {
          type: "timeout_error",
          cause: error,
        });
      }

      throw new ApiServerError("Network error from API server", {
        type: "network_error",
        cause: error,
      });
    }
  }

  async getUsage(params: UsageQueryParams = {}): Promise<UsageResponse> {
    const query = buildUsageQueryString(params);
    return this.request<UsageResponse>("GET", `/usage${query}`, {
      authenticated: true,
    });
  }

  async getChains(): Promise<ApiChainInfo[]> {
    return this.request<ApiChainInfo[]>("GET", "/chains");
  }

  async listApiKeys(): Promise<CustomerApiKey[]> {
    return this.request<CustomerApiKey[]>("GET", "/api-keys", {
      authenticated: true,
    });
  }

  async createApiKey(input: CreateApiKeyInput): Promise<CreatedApiKey> {
    return this.request<CreatedApiKey>("POST", "/api-keys", {
      body: input,
      authenticated: true,
    });
  }

  async updateApiKey(
    apiKey: string,
    input: UpdateApiKeyInput
  ): Promise<CustomerApiKey> {
    return this.request<CustomerApiKey>(
      "PUT",
      `/api-keys/${encodeURIComponent(apiKey)}`,
      { body: input, authenticated: true }
    );
  }
}
