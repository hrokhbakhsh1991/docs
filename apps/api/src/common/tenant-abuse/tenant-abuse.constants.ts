export const TENANT_ABUSE_REDIS = Symbol("TENANT_ABUSE_REDIS");

/** Prometheus / JSON scope labels — low cardinality (no raw tenant id). */
export type TenantRateLimitScope =
  | "api_tenant"
  | "api_user"
  | "api_ip"
  | "login_tenant"
  | "login_ip"
  | "job_tenant";
