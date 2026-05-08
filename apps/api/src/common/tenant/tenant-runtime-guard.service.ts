import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import { Inject } from "@nestjs/common";
import {
  TENANT_RATE_LIMIT_POLICY,
  TENANT_USAGE_METERING_POLICY,
  type TenantRateLimitPolicy,
  type TenantUsageMeteringPolicy
} from "../contracts/tenant-runtime.contract";

export type TenantRuntimeAction = "http_rate_limit" | "http_usage_metering" | "http_all";

@Injectable()
export class TenantRuntimeGuardService {
  constructor(
    @Inject(TENANT_RATE_LIMIT_POLICY)
    private readonly tenantRateLimitService: TenantRateLimitPolicy,
    @Inject(TENANT_USAGE_METERING_POLICY)
    private readonly tenantUsageMeteringService: TenantUsageMeteringPolicy
  ) {}

  async enforceTenantRuntimePolicies(
    req: Request,
    action: TenantRuntimeAction
  ): Promise<void> {
    if (action === "http_rate_limit") {
      await this.tenantRateLimitService.enforceHttpRateLimit(req);
      return;
    }
    if (action === "http_usage_metering") {
      await this.tenantUsageMeteringService.enforceHttpUsageMetering(req);
      return;
    }
    await this.tenantRateLimitService.enforceHttpRateLimit(req);
    await this.tenantUsageMeteringService.enforceHttpUsageMetering(req);
  }
}
