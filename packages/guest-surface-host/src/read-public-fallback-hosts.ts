/** Comma-separated bare hosts (IP/loopback) allowed to use public tenant fallback on VPS staging. */
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
