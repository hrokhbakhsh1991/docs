import {
  validateTenantSurfaceOriginMap,
  type TenantSurfaceName,
} from "@app-tour/guest-surface-host/tenant-surface-origin-map";

const STAGING_HOST_SUFFIX = ".staging.test";
const SURFACES: readonly TenantSurfaceName[] = ["admin", "marketing", "portal"];

export type PrivateStagingTenantHostBinding = {
  readonly tenantId: string;
  readonly surface: TenantSurfaceName;
};

/**
 * Resolve only operator-configured private staging hosts. Public custom domains
 * continue through tenant_domains and its CNAME verification lifecycle.
 */
export function resolvePrivateStagingTenantHost(
  host: string,
  env: NodeJS.ProcessEnv = process.env
): PrivateStagingTenantHostBinding | null {
  const hostname = host.trim().toLowerCase();
  if (
    env.APP_INFRA_PROFILE !== "staging" ||
    !hostname.endsWith(STAGING_HOST_SUFFIX) ||
    hostname.includes(":") ||
    hostname.includes("/")
  ) {
    return null;
  }

  const rawMap = env.TENANT_SURFACE_ORIGIN_MAP_JSON?.trim();
  if (!rawMap) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawMap);
  } catch {
    throw new Error("TENANT_SURFACE_ORIGIN_MAP_JSON must contain valid JSON");
  }
  const map = validateTenantSurfaceOriginMap(parsed);

  for (const tenant of map.tenants) {
    for (const surface of SURFACES) {
      const hosts = [
        tenant.origins[surface],
        ...(tenant.aliases?.[surface] ?? []).map((alias) => alias.origin),
      ];
      if (hosts.some((origin) => new URL(origin).hostname === hostname)) {
        return { tenantId: tenant.tenantId, surface };
      }
    }
  }
  return null;
}
