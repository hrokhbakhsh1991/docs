/** Comma-separated bare hosts (IP/loopback) allowed to use default tenant on VPS staging. */
export function readPublicFallbackHostsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): ReadonlySet<string> {
  const raw =
    env.TOUR_OPS_PUBLIC_FALLBACK_HOSTS?.trim() ??
    env.PUBLIC_TENANT_FALLBACK_HOSTS?.trim() ??
    "";
  if (raw.length === 0) {
    return new Set();
  }
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase().split(":")[0] ?? "")
      .filter((entry) => entry.length > 0)
  );
}

export function readDefaultPublicTenantIdFromEnv(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const tenantId =
    env.TOUR_OPS_DEFAULT_TENANT_ID?.trim() ??
    env.TOUR_OPS_DEV_TENANT_ID?.trim() ??
    env.NEXT_PUBLIC_DEV_TENANT_ID?.trim() ??
    "";
  return tenantId.length > 0 ? tenantId : null;
}

function isIpv4Host(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

export function isBarePublicIngressHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().split(":")[0] ?? "";
  if (normalized.length === 0) {
    return false;
  }
  return normalized === "localhost" || normalized === "127.0.0.1" || isIpv4Host(normalized);
}

export function shouldUsePublicTenantFallback(host: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const hostname = host.trim().toLowerCase().split(":")[0] ?? "";
  const allowedHosts = readPublicFallbackHostsFromEnv(env);
  if (allowedHosts.size > 0) {
    return allowedHosts.has(hostname);
  }
  return isBarePublicIngressHost(hostname);
}

export function resolvePublicFallbackTenantId(
  host: string,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if (!shouldUsePublicTenantFallback(host, env)) {
    return null;
  }
  return readDefaultPublicTenantIdFromEnv(env);
}
