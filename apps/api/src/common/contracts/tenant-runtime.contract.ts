import type { Request } from "express";
import type { TenantRuntimeAction } from "../tenant/tenant-runtime-guard.service";

export const TENANT_RATE_LIMIT_POLICY = Symbol("TENANT_RATE_LIMIT_POLICY");
export const TENANT_USAGE_METERING_POLICY = Symbol("TENANT_USAGE_METERING_POLICY");
export const TENANT_RUNTIME_GUARD = Symbol("TENANT_RUNTIME_GUARD");

export interface TenantRateLimitPolicy {
  enforceHttpRateLimit(req: Request): Promise<void>;
}

export interface TenantUsageMeteringPolicy {
  enforceHttpUsageMetering(req: Request): Promise<void>;
}

export interface TenantRuntimeGuard {
  enforceTenantRuntimePolicies(req: Request, action: TenantRuntimeAction): Promise<void>;
}
