import type { Request } from "express";
import type { ConfigService } from "../../config/config.service";
import type { RequestContextService } from "../request-context/request-context.service";
import { resolveThrottleClientIp } from "../throttling/public-registration-throttle";
import { isAuthSessionLoginRoute } from "../auth/auth-route-policy";

const UUID_PATH_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

/**
 * Partition key for unauthenticated `/api/v2` traffic — never a shared `_public` bucket.
 * Prefers catalog entity ids from the request path, then host/subdomain signature.
 */
export function resolvePartitionedPublicRateLimitBucket(
  req: Pick<Request, "path" | "url" | "headers" | "hostname">,
): string {
  const path = resolveTenantRuntimePath(req);

  const tourCatalogMatch = path.match(/^\/api\/v2\/tours\/([^/]+)/);
  const tourId = tourCatalogMatch?.[1]?.trim().toLowerCase();
  if (tourId && UUID_PATH_SEGMENT.test(tourId)) {
    return `catalog:tour:${tourId}`;
  }

  const registrationCatalogMatch = path.match(/^\/api\/v2\/registrations\/([^/]+)/);
  const registrationId = registrationCatalogMatch?.[1]?.trim().toLowerCase();
  if (registrationId && UUID_PATH_SEGMENT.test(registrationId)) {
    return `catalog:registration:${registrationId}`;
  }

  const hostHeader = req.headers.host;
  if (typeof hostHeader === "string" && hostHeader.trim()) {
    const hostOnly = hostHeader.split(",")[0]?.trim().toLowerCase().replace(/:\d+$/, "");
    if (hostOnly) {
      return `host:${hostOnly}`;
    }
  }

  const hostname = typeof req.hostname === "string" ? req.hostname.trim().toLowerCase() : "";
  if (hostname) {
    return `host:${hostname}`;
  }

  return "host:unknown";
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
