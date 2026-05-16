import { ForbiddenException, Inject, Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { LoggerService } from "../logger/logger.service";
import { RequestContextService } from "../request-context/request-context.service";

type RequestWithOptionalUserTenant = Request & {
  user?: { tenantId?: string };
};

type RequestWithOptionalContextTenant = Request & {
  context?: { tenantId?: string };
};

/**
 * Paths that must not require a bound workspace tenant (probes, OpenAPI, auth entry,
 * internal webhooks/ops, and public registration flows).
 *
 * **Keep in sync** with {@link TenantMiddleware} bypass rules — a stricter guard here
 * would 403 legitimate anonymous `POST /api/v2/tours/:id/register|waitlist` (or `GET …/registration-idempotency-key`) traffic after
 * express middleware skipped binding tenant until the controller bootstraps scope.
 */
function shouldBypassTenantGuard(req: Request): boolean {
  const { path, method } = req;
  return (
    path.startsWith("/health") ||
    path.startsWith("/api/docs") ||
    path.startsWith("/api/v2/auth/") ||
    path.startsWith("/internal") ||
    (method === "POST" && /^\/api\/v2\/tours\/[^/]+\/(register|waitlist)$/.test(path)) ||
    (method === "GET" &&
      /^\/api\/v2\/tours\/[^/]+\/registration-idempotency-key$/.test(path)) ||
    (method === "GET" && /^\/api\/v2\/registrations\/[^/]+$/.test(path))
  );
}

/**
 * Trusted tenant id: only server-populated {@link RequestContextService} (ALS) or
 * `request.context.tenantId` / `request.user.tenantId` when set by trusted middleware.
 * Never reads body, query, or route params for tenant selection.
 */
function resolveTrustedTenantId(req: Request, requestContextService: RequestContextService): string | undefined {
  const fromAls = requestContextService.tryGetTenantId()?.trim();
  if (fromAls) {
    return fromAls;
  }
  const ctxRaw = (req as RequestWithOptionalContextTenant).context?.tenantId;
  const fromReqContext = typeof ctxRaw === "string" ? ctxRaw.trim() : "";
  if (fromReqContext !== "") {
    return fromReqContext.toLowerCase();
  }
  const raw = (req as RequestWithOptionalUserTenant).user?.tenantId;
  const fromUser = typeof raw === "string" ? raw.trim() : "";
  return fromUser !== "" ? fromUser.toLowerCase() : undefined;
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

    const tenantId = resolveTrustedTenantId(req, this.requestContextService);
    if (!tenantId) {
      this.loggerService.warn("tenant_guard: missing tenant for protected route", {
        path: req.path,
        method: req.method,
        request_id: this.requestContextService.tryGetRequestId()
      });
      throw new ForbiddenException({
        error: {
          code: "TENANT_CONTEXT_REQUIRED",
          message: "TENANT_CONTEXT_REQUIRED"
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
