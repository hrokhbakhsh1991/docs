import { logBffError, logBffEvent } from "@/lib/logging/bff-logger";
import { createAppError } from "@/lib/errors/app-error";
import {
  buildApiBaseUrlFromTenant,
  buildBffProxyHeadersFromTenant,
} from "@/lib/api/get-api-base-url";
import { resolveBffTenantContext } from "@/lib/tenant/runtime-tenant-context";
import {
  generateRequestId,
  generateTraceparent,
  getRequestIdFromHeaders,
  getTraceparentFromHeaders,
} from "@/lib/api/tracing-utils";

import { lookupWorkspaceTenantMetadata } from "@/lib/tenant/lookup-workspace-tenant";

async function assertBffWorkspaceKnown(req: Request): Promise<void> {
  const tenant = resolveBffTenantContext(req);
  const metadata = await lookupWorkspaceTenantMetadata(tenant.tenantSlug);

  if (!metadata) {
    throw createAppError("TENANT_HOST_UNKNOWN", "No workspace matches this host", {
      tenantSlug: tenant.tenantSlug,
    });
  }

  // Enforce session tenant alignment when host tenant id was resolved from API (not dev fail-open).
  const hostTenantId =
    metadata.tenantId && metadata.tenantId !== "unknown" ? metadata.tenantId : undefined;
  if (hostTenantId && tenant.tenantId && tenant.tenantId !== hostTenantId) {
    logBffError("tenant_mismatch_detected", {
      tenant_mismatch: true,
      correlation_id: generateRequestId(),
    });
    throw createAppError(
      "TENANT_HOST_TOKEN_MISMATCH",
      "Your session does not belong to this workspace",
      {
        hostSlug: tenant.tenantSlug,
        sessionTenantId: tenant.tenantId,
      },
    );
  }
}

/**
 * Tenant-scoped fetch for BFF route handlers. Slug from Host only; probes workspace before upstream.
 */
export async function bffFetch(
  req: Request,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  await assertBffWorkspaceKnown(req);
  const tenant = resolveBffTenantContext(req);
  const url = `${buildApiBaseUrlFromTenant(tenant)}${path.startsWith("/") ? path : `/${path}`}`;

  const requestId = getRequestIdFromHeaders(req.headers) || generateRequestId();
  const traceparent = getTraceparentFromHeaders(req.headers) || generateTraceparent();

  const baseHeaders = buildBffProxyHeadersFromTenant(tenant);
  const merged = new Headers(baseHeaders);
  merged.set("x-request-id", requestId);
  merged.set("traceparent", traceparent);

  if (options.headers) {
    new Headers(options.headers).forEach((value, key) => {
      merged.set(key, value);
    });
  }

  // FormData must not carry application/json — fetch sets multipart boundary automatically.
  if (options.body instanceof FormData) {
    merged.delete("Content-Type");
  }

  const method = (options.method ?? "GET").toUpperCase();
  logBffEvent("bff_fetch", {
    tenant_slug: tenant.tenantSlug,
    tenant_id: tenant.tenantId,
    method,
    path,
  });

  const upstreamStarted = Date.now();
  try {
    const response = await fetch(url, {
      ...options,
      headers: merged,
      cache: options.cache ?? "no-store",
    });
    const bffLatencyMs = Date.now() - upstreamStarted;
    if (!response.ok) {
      const requestId = response.headers.get("x-request-id") ?? undefined;
      const traceparentHeader = response.headers.get("traceparent") ?? undefined;
      logBffError("upstream_non_ok", {
        requestId,
        traceparent: traceparentHeader || traceparent,
        endpoint: path,
        tenantSlug: tenant.tenantSlug,
        tenantId: tenant.tenantId,
        status: response.status,
        bff_latency_ms: bffLatencyMs,
        api_latency_ms: response.headers.get("x-api-latency") ?? undefined,
      });
    }
    return response;
  } catch (cause) {
    if (cause && typeof cause === "object" && "code" in cause) {
      throw cause;
    }
    logBffError(cause instanceof Error ? cause.message : "fetch_failed", {
      endpoint: path,
      tenantSlug: tenant.tenantSlug,
      tenantId: tenant.tenantId,
    });
    throw createAppError("API_UPSTREAM_FAILED", "Backend request failed", {
      tenantSlug: tenant.tenantSlug,
      path,
    });
  }
}
