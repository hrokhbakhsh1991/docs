/**
 * Single-build multi-tenant: browser calls API on `{browserHost}:{NEXT_PUBLIC_API_PORT}`
 * so Nest sees `Host: {tenant}.{root}` for tenant resolution.
 *
 * - Fixed URL: set `NEXT_PUBLIC_API_URL` only (legacy / SSR-safe absolute origin).
 * - Dynamic: set `NEXT_PUBLIC_API_DYNAMIC_ORIGIN=true` plus optional `NEXT_PUBLIC_API_PORT`
 *   when API listens on a different port than the Next.js UI (typical local docker-compose).
 *   On the server (SSR/Node), falls back to `NEXT_PUBLIC_API_URL` — keep it set for builds.
 */

let didWarnApiUrlHadVersionPathSuffix = false;

export function normalizeTourOpsApiOrigin(raw: string): string {
  let s = raw.trim().replace(/\/$/, "");
  const suffix = "/api/v2";
  let stripped = false;
  while (s.endsWith(suffix)) {
    s = s.slice(0, -suffix.length).replace(/\/$/, "");
    stripped = true;
  }
  if (
    stripped &&
    process.env.NODE_ENV === "development" &&
    !didWarnApiUrlHadVersionPathSuffix
  ) {
    didWarnApiUrlHadVersionPathSuffix = true;
    const message =
      "[tour-ops-api-origin] API base URL ended with /api/v2; using origin only. Set TOUR_OPS_API_URL or NEXT_PUBLIC_API_URL to the origin only (e.g. http://localhost:3001), not …/api/v2.";
    queueMicrotask(() => {
      console.warn(message);
    });
  }
  return s;
}

export function isTourOpsApiDynamicOrigin(): boolean {
  const v = process.env.NEXT_PUBLIC_API_DYNAMIC_ORIGIN?.trim().toLowerCase();
  return v === "true" || v === "1";
}

/**
 * Current browser hostname (no port). Undefined during SSR / Node scripts.
 */
export function readBrowserHostname(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const h = window.location.hostname?.trim();
  return h || undefined;
}

export function resolveTourOpsApiBaseUrl(): string {
  const explicit = normalizeTourOpsApiOrigin(process.env.NEXT_PUBLIC_API_URL ?? "");

  if (!isTourOpsApiDynamicOrigin()) {
    return explicit;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const portEnv = process.env.NEXT_PUBLIC_API_PORT?.trim();
    if (portEnv) {
      return `${protocol}//${hostname}:${portEnv}`;
    }
    const locPort = window.location.port?.trim();
    if (locPort) {
      return `${protocol}//${hostname}:${locPort}`;
    }
    return `${protocol}//${hostname}`;
  }

  return explicit;
}

/** Gate UI blocks that require calling Tour-Ops HTTP APIs. */
export function isTourOpsApiConfigured(): boolean {
  const hasExplicit = Boolean(
    normalizeTourOpsApiOrigin(process.env.NEXT_PUBLIC_API_URL ?? "")
  );
  if (!isTourOpsApiDynamicOrigin()) {
    return hasExplicit;
  }
  return typeof window !== "undefined" || hasExplicit;
}
