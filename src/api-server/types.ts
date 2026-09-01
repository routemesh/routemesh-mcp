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

// ── Provider-scoped API (GET/PUT/POST /provider/*) ─────────────────────────
// Authenticated with the same customer management token, but the token's
// customer must be linked to a provider. Resources owned by another provider
// are reported as 404 (existence is not leaked).

export type ProviderPlan = {
  id: number;
  created_at: string;
  provider: string;
  provider_id: number;
  name: string;
  price: number;
  quota: number;
  quota_unit: string;
  description: string;
  overage_price: number;
  overage_limit: number;
  rate_limit_req: number;
  rate_limit_req_interval_sec: number;
  rate_limit_cr: number;
  rate_limit_cr_interval_sec: number;
  billing_fixed_day?: number | null;
  billing_interval_days?: number | null;
  billing_anchored_start_date?: string | null;
};

export type ProviderPlanMethod = {
  id: number;
  created_at: string;
  plan_id: number;
  method: string;
  vm: string;
  node_target_type: string;
  cost: number;
  rate_limit: number | null;
  rate_limit_interval_sec: number | null;
  // An empty/absent chain ID means the cost applies to all chains for the plan.
  chain_id: string | null;
};

export type ProviderNodeStatusResponse = {
  node_id: number;
  in_sync: boolean;
  status: "ok" | "out_of_sync";
};

export type ProviderNodeSource =
  | "provider"
  | "website"
  | "erpc"
  | "node_request"
  | "new_chain_request";

export type ProviderNode = {
  id: number;
  plan_id: number;
  url: string;
  vm: string;
  chain_id: string;
  rate_limit: number | null;
  rate_limit_interval_sec: number | null;
  node_type: string;
  source: ProviderNodeSource;
  node_request_id?: number | null;
  created_at: string;
};

export type ProviderUpsertNodeInput = {
  plan_id: number;
  url: string;
  vm: string;
  rate_limit: number;
  rate_limit_interval_sec: number;
  source?: ProviderNodeSource;
};

export type ProviderUpsertNodeResponse = {
  message: string;
  node: ProviderNode;
  status: string;
};

export type ProviderNodeWS = {
  id: number;
  plan_id: number;
  chain_id: string;
  url: string;
  created_at: string;
};

export type ProviderUpsertWSNodeInput = {
  plan_id: number;
  chain_id: string;
  url: string;
};

export type ProviderUpsertWSNodeResponse = {
  message: string;
  node_ws: ProviderNodeWS;
  status: string;
};

// Statuses a provider may set via POST /provider/nodes/status
// (portal parity: enable / disable / delete).
export const PROVIDER_NODE_STATUSES = [
  "healthy",
  "disabled by provider",
  "provider-deleted",
] as const;

export type ProviderNodeStatus = (typeof PROVIDER_NODE_STATUSES)[number];

export type ProviderSetNodeStatusInput = {
  node_id: number;
  status: ProviderNodeStatus;
};

export type ProviderSetNodeStatusResponse = {
  node_id: number;
  status: string;
};

// A single RPC method row for POST /provider/plans/:planId/methods.
// Mirrors models.RPCMethodInput on the API server.
export type ProviderPlanMethodInput = {
  method: string;
  vm: string;
  node_target_type: string;
  cost: number;
  rate_limit?: number;
  rate_limit_interval_sec?: number;
  chain_id?: string | null;
};
