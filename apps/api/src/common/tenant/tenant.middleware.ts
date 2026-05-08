import { ForbiddenException, Inject, Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request } from "express";
import { LoggerService } from "../logger/logger.service";
import { RequestContextService } from "../request-context/request-context.service";

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    @Inject(RequestContextService)
    private readonly requestContextService: RequestContextService,
    @Inject(LoggerService) private readonly loggerService: LoggerService
  ) {}

  use(req: Request, _res: unknown, next: NextFunction): void {
    // Bypass tenant resolution for all health probes (/health, /health/live, /health/ready, ...)
    // Auth v2 entry endpoints skip JWT here; workspace tenant for login comes from Host via TenantResolverMiddleware.
    if (
      (req.method === "POST" &&
        /^\/api\/v2\/tours\/[^/]+\/(register|waitlist)$/.test(req.path)) ||
      (req.method === "GET" &&
        /^\/api\/v2\/registrations\/[^/]+$/.test(req.path)) ||
      req.path.startsWith("/health") ||
      req.path.startsWith("/internal") ||
      req.path.startsWith("/api/docs") ||
      req.path.startsWith("/api/v2/auth/")
    ) {
      return next();
    }

    const { tenantId } = this.requestContextService.resolveTenantContext(req);

    if (!tenantId) {
      this.loggerService.warn("tenant resolution failed", {
        path: req.path,
        method: req.method,
        requestId: this.requestContextService.getRequestId()
      });
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_MISSING",
          message: "Trusted tenant context required but absent"
        }
      });
    }

    this.requestContextService.setTenantId(tenantId);
    next();
  }
}
