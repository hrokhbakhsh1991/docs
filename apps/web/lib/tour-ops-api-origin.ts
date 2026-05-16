import { buildApiBaseUrlFromTenant } from "@/lib/api/get-api-base-url";
import { resolveClientRuntimeTenantContext } from "@/lib/tenant/runtime-tenant-context";

/**
 * Browser Tour-Ops API origin — tenant slug from host via {@link getApiBaseUrl} / runtime context.
 * No `NEXT_PUBLIC_API_URL` fallback (Lock D).
 */

export function normalizeTourOpsApiOrigin(raw: string): string {
  let s = raw.trim().replace(/\/$/, "");
  const suffix = "/api/v2";
  while (s.endsWith(suffix)) {
    s = s.slice(0, -suffix.length).replace(/\/$/, "");
  }
  return s;
}

export function isTourOpsApiDynamicOrigin(): boolean {
  const v = process.env.NEXT_PUBLIC_API_DYNAMIC_ORIGIN?.trim().toLowerCase();
  return v === "true" || v === "1";
}

export function readBrowserHostname(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const h = window.location.hostname?.trim();
  return h || undefined;
}

export function resolveTourOpsApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return buildApiBaseUrlFromTenant(resolveClientRuntimeTenantContext());
  }
  if (isTourOpsApiDynamicOrigin()) {
    const port = process.env.NEXT_PUBLIC_API_PORT?.trim() || "3001";
    return `http://localhost:${port}`;
  }
  return "";
}

export function isTourOpsApiConfigured(): boolean {
  if (typeof window !== "undefined") {
    return true;
  }
  return isTourOpsApiDynamicOrigin();
}
