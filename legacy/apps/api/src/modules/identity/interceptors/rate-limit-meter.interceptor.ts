import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { Observable } from "rxjs";
import { TourLifecycleStatus } from "@repo/domain-contracts";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import {
  isTenantRuntimeApiPath,
  shouldBypassTenantRuntimePath,
} from "../../../common/tenant/tenant-runtime-policy";
import {
  WORKSPACE_METERING_PORT,
  type WorkspaceMeteringPort,
  type WorkspaceQuotaScope,
} from "../../../common/billing/workspace-metering.port";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

@Injectable()
export class RateLimitMeterInterceptor implements NestInterceptor {
  constructor(
    @Inject(WORKSPACE_METERING_PORT)
    private readonly workspaceMetering: WorkspaceMeteringPort,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    await this.enforceWorkspaceTierLimits(req);
    return next.handle();
  }

  private async enforceWorkspaceTierLimits(req: Request): Promise<void> {
    const path = typeof req.path === "string" ? req.path : req.url ?? "";
    if (shouldBypassTenantRuntimePath(path) || !isTenantRuntimeApiPath(path)) {
      return;
    }
    const method = (req.method ?? "GET").toUpperCase();
    if (!MUTATION_METHODS.has(method)) {
      return;
    }

    const quotaScope = resolveQuotaScope(method, path, req.body);
    if (!quotaScope) {
      return;
    }

    const tenantId = this.requestContext.resolveTenantContext(req).tenantId;
    if (!tenantId) {
      return;
    }

    const [limits, usage] = await Promise.all([
      this.workspaceMetering.getCachedPlanLimits(tenantId),
      this.workspaceMetering.getCachedUsageSnapshot(tenantId),
    ]);

    if (quotaScope === "active_tours") {
      if (limits.maxActiveTours != null && usage.activeTours >= limits.maxActiveTours) {
        this.throwQuotaExceeded("active_tours", tenantId);
      }
      return;
    }

    if (limits.maxUsers != null && usage.users >= limits.maxUsers) {
      this.throwQuotaExceeded("users", tenantId);
    }
  }

  private throwQuotaExceeded(scope: WorkspaceQuotaScope, tenantId: string): never {
    throw new HttpException(
      {
        error: {
          code: "TENANT_QUOTA_EXCEEDED",
          message: "Tenant usage quota exceeded",
          retryability: "RETRY_WITH_BACKOFF",
          details: { quota_scope: scope, tenant_id: tenantId },
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

function resolveQuotaScope(
  method: string,
  path: string,
  body: unknown,
): WorkspaceQuotaScope | null {
  if (method === "POST" && path === "/api/v2/tours") {
    return "active_tours";
  }

  if (method === "PATCH" && /^\/api\/v2\/tours\/[^/]+$/.test(path)) {
    const lifecycle = readLifecycleStatus(body);
    if (lifecycle === TourLifecycleStatus.OPEN) {
      return "active_tours";
    }
  }

  if (method === "POST" && path === "/api/v2/users/invite") {
    return "users";
  }

  if (method === "POST" && path === "/api/v2/users") {
    return "users";
  }

  return null;
}

function readLifecycleStatus(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  const snake = record.lifecycle_status;
  if (typeof snake === "string") {
    return snake.trim().toUpperCase();
  }
  const camel = record.lifecycleStatus;
  if (typeof camel === "string") {
    return camel.trim().toUpperCase();
  }
  return undefined;
}
