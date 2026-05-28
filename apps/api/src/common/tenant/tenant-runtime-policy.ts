import type { Request } from "express";
import type { ConfigService } from "../../config/config.service";
import type { RequestContextService } from "../request-context/request-context.service";
import { resolveThrottleClientIp } from "../throttling/public-registration-throttle";
import { isAuthSessionLoginRoute } from "../auth/auth-route-policy";

export function resolveTenantRuntimePath(req: Pick<Request, "path" | "url">): string {
  return typeof req.path === "string" ? req.path : req.url;
}

export function isTenantRuntimeApiPath(path: string): boolean {
  return path.startsWith("/api/v2");
}

export function isTenantRuntimeLoginRoute(path: string, method: string): boolean {
  return isAuthSessionLoginRoute(path, method);
}

export function shouldBypassTenantRuntimePath(path: string): boolean {
  return (
    path.startsWith("/health") ||
    path.startsWith("/internal") ||
    path.startsWith("/api/docs")
  );
}

export function getTenantScopeKey(
  scope: "tenant" | "user" | "ip",
  req: Request,
  deps: {
    requestContextService: Pick<
      RequestContextService,
      "resolveTenantContext" | "tryGetUserId"
    >;
    configService: Pick<ConfigService, "getTrustedProxyCidrs">;
  }
): string | undefined {
  if (scope === "tenant") {
    return deps.requestContextService.resolveTenantContext(req).tenantId;
  }
  if (scope === "user") {
    const userId = deps.requestContextService.tryGetUserId();
    return userId && userId.trim() !== "" ? userId.trim() : undefined;
  }
  const ip = resolveThrottleClientIp(req as unknown as Record<string, unknown>, {
    trustedProxyCidrs: deps.configService.getTrustedProxyCidrs()
  });
  return ip;
}

export async function enforceBackgroundTenantRuntimePolicies(
  tenantId: string,
  checks: {
    tryConsumeBackgroundJob: (_tenantId: string) => Promise<boolean>;
    tryConsumeTenantJobRateLimit: (_tenantId: string) => Promise<boolean>;
  }
): Promise<boolean> {
  const quotaAllowed = await checks.tryConsumeBackgroundJob(tenantId);
  if (!quotaAllowed) {
    return false;
  }
  const jobAllowed = await checks.tryConsumeTenantJobRateLimit(tenantId);
  if (!jobAllowed) {
    return false;
  }
  return true;
}
