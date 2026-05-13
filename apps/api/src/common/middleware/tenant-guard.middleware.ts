import { ForbiddenException, Inject, Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { LoggerService } from "../logger/logger.service";
import { RequestContextService } from "../request-context/request-context.service";

/**
 * Defense-in-depth after {@link TenantMiddleware}: every non-bypassed `/api/v2/**` request
 * must resolve a canonical `tenantId` before handlers run.
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

    const tenantId = this.requestContextService.resolveEffectiveTenantId(req)?.trim();
    if (!tenantId) {
      this.loggerService.warn("tenant_guard: missing tenant for protected route", {
        path: req.path,
        method: req.method,
        request_id: this.requestContextService.tryGetRequestId()
      });
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_REQUIRED",
          message: "Trusted tenant context is required for this operation"
        }
      });
    }

    const userId = this.requestContextService.tryGetUserId()?.trim();
    if (userId) {
      this.loggerService.debug("tenant_guard: authenticated tenant context", {
        path: req.path,
        method: req.method,
        tenant_id: tenantId
      });
    }

    next();
  }
}
