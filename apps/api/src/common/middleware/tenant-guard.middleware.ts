import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { LoggerService } from "../logger/logger.service";
import { RequestContextService } from "../request-context/request-context.service";

/**
 * Phase 1 skeleton: runs after {@link TenantMiddleware} when tenant context is present.
 * Extend in later phases (per-route policies, RLS session variables, secondary host/JWT checks).
 *
 * Keep bypass list aligned with {@link TenantMiddleware} for anonymous/public flows.
 */
function shouldBypassTenantGuard(req: Request): boolean {
  return (
    (req.method === "POST" &&
      /^\/api\/v2\/tours\/[^/]+\/(register|waitlist)$/.test(req.path)) ||
    (req.method === "GET" && /^\/api\/v2\/registrations\/[^/]+$/.test(req.path)) ||
    req.path.startsWith("/health") ||
    req.path.startsWith("/internal") ||
    req.path.startsWith("/api/docs") ||
    req.path.startsWith("/api/v2/auth/")
  );
}

@Injectable()
export class TenantGuardMiddleware implements NestMiddleware {
  constructor(
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(LoggerService) private readonly loggerService: LoggerService
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    if (shouldBypassTenantGuard(req)) {
      return next();
    }

    const tenantId = this.requestContextService.resolveEffectiveTenantId(req);
    const userId = this.requestContextService.tryGetUserId();

    if (tenantId && userId) {
      this.loggerService.debug("tenant_guard: authenticated tenant context", {
        path: req.path,
        method: req.method,
        tenant_id: tenantId
      });
    }

    next();
  }
}
