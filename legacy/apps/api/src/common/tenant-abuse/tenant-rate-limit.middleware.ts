import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { Inject } from "@nestjs/common";
import {
  TENANT_RUNTIME_GUARD,
  type TenantRuntimeGuard
} from "../contracts/tenant-runtime.contract";

/**
 * Redis sliding-window limits keyed by tenant / user / IP (HTTP).
 * Runs after {@link TenantMiddleware} so JWT tenant context is populated for most `/api/v2` routes.
 * Unauthenticated catalog probes shard by entity id or host signature — never a shared `_public` bucket.
 */
@Injectable()
export class TenantRateLimitMiddleware implements NestMiddleware {
  constructor(
    @Inject(TENANT_RUNTIME_GUARD)
    private readonly tenantRuntimeGuardService: TenantRuntimeGuard
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      await this.tenantRuntimeGuardService.enforceTenantRuntimePolicies(req, "http_rate_limit");
      next();
    } catch (err) {
      next(err);
    }
  }
}
