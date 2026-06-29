export const USAGE_INCLUDE_SECTIONS = [
  "summary",
  "balance",
  "by_chain",
  "by_api_key",
  "by_api_key_chain",
  "top_methods",
  "time_series",
  "by_scenario",
] as const;

export type UsageIncludeSection = (typeof USAGE_INCLUDE_SECTIONS)[number];

export const USAGE_GROUP_BY_VALUES = [
  "chain",
  "api_key",
  "api_key,chain",
  "method",
  "day",
] as const;

export type UsageGroupBy = (typeof USAGE_GROUP_BY_VALUES)[number];

export const USAGE_GRANULARITY_VALUES = ["day", "hour"] as const;

export type UsageGranularity = (typeof USAGE_GRANULARITY_VALUES)[number];

export type UsageQueryParams = {
  from?: string;
  to?: string;
  include?: UsageIncludeSection[];
  groupBy?: UsageGroupBy;
  chainId?: string;
  apiKeyId?: number;
  granularity?: UsageGranularity;
  limit?: number;
};

export type UsageResponse = Record<string, unknown>;

export type ApiChainInfo = { chain_id: string; name: string };

export type RoutingStrategy = "performance" | "economy";

export type CustomerApiKey = {
  id: number;
  name: string | null;
  active: boolean;
  allowed_domains: string[];
  routing_strategy: RoutingStrategy;
  created_at: string;
  updated_at: string;
};

export type CreateApiKeyInput = {
  allowed_domains: string[];
  routing_strategy: RoutingStrategy;
  name?: string;
};

export type UpdateApiKeyInput = {
  allowed_domains?: string[];
  name?: string;
  active?: boolean;
};

export type CreatedApiKey = CustomerApiKey & { api_key: string };
