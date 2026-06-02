import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { Inject } from "@nestjs/common";
import {
  TENANT_RUNTIME_GUARD,
  type TenantRuntimeGuard
} from "../contracts/tenant-runtime.contract";

@Injectable()
export class TenantUsageMiddleware implements NestMiddleware {
  constructor(
    @Inject(TENANT_RUNTIME_GUARD)
    private readonly tenantRuntimeGuardService: TenantRuntimeGuard
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      await this.tenantRuntimeGuardService.enforceTenantRuntimePolicies(
        req,
        "http_usage_metering"
      );
      next();
    } catch (err) {
      next(err);
    }
  }
}

