export type TenantSurfaceName = "admin" | "marketing" | "portal";

export type TenantSurfaceBinding = {
  readonly tenantId: string;
  readonly origins: Readonly<Record<TenantSurfaceName, string>>;
  readonly cookieDomain: string | null;
  readonly aliases?: Readonly<
    Partial<Record<TenantSurfaceName, readonly { origin: string; cookieDomain: string | null }[]>>
  >;
};

type TenantSurfaceOriginMap = {
  readonly version: 1;
  readonly tenants: readonly TenantSurfaceBinding[];
};

const MAP_ENV = "TENANT_SURFACE_ORIGIN_MAP_JSON";
const SURFACES: readonly TenantSurfaceName[] = ["admin", "marketing", "portal"];
const TENANT_ID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function parseOrigin(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be an HTTPS origin`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${field} must be an HTTPS origin`);
  }
  if (
    url.protocol !== "https:" ||
    url.hostname.endsWith(".") ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.port.length > 0 ||
    url.pathname !== "/" ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error(`${field} must be a portless HTTPS origin without credentials or path`);
  }
  return url.origin;
}

function normalizeCookieDomain(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a hostname or null`);
  }
  let url: URL;
  try {
    url = new URL(`https://${value.trim()}`);
  } catch {
    throw new Error(`${field} must be a hostname or null`);
  }
  if (
    url.username ||
    url.password ||
    url.hostname.endsWith(".") ||
    url.port ||
    url.pathname !== "/" ||
    url.hostname !== value.trim().toLowerCase()
  ) {
    throw new Error(`${field} must be a normalized hostname without a port`);
  }
  return url.hostname;
}

export function validateTenantSurfaceOriginMap(raw: unknown): TenantSurfaceOriginMap {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("tenant surface origin map must be an object");
  }
  const value = raw as Record<string, unknown>;
  if (value.version !== 1 || !Array.isArray(value.tenants) || value.tenants.length === 0) {
    throw new Error("tenant surface origin map must contain version 1 and at least one tenant");
  }

  const tenantIds = new Set<string>();
  const hostnames = new Set<string>();
  const cookieDomainsByTenant: string[][] = [];
  const bindings: TenantSurfaceBinding[] = value.tenants.map((rawTenant, index) => {
    if (rawTenant === null || typeof rawTenant !== "object" || Array.isArray(rawTenant)) {
      throw new Error(`tenant entry ${index} must be an object`);
    }
    const tenant = rawTenant as Record<string, unknown>;
    if (typeof tenant.tenantId !== "string" || !TENANT_ID_PATTERN.test(tenant.tenantId.trim())) {
      throw new Error(`tenant entry ${index} requires a UUID tenantId`);
    }
    const tenantId = tenant.tenantId.trim().toLowerCase();
    if (tenantIds.has(tenantId)) throw new Error("tenant IDs must be distinct");
    tenantIds.add(tenantId);

    if (
      tenant.origins === null ||
      typeof tenant.origins !== "object" ||
      Array.isArray(tenant.origins)
    ) {
      throw new Error(`tenant entry ${index} requires an origin map`);
    }
    const rawOrigins = tenant.origins as Record<string, unknown>;
    const origins = {} as Record<TenantSurfaceName, string>;
    for (const surface of SURFACES) {
      const origin = parseOrigin(rawOrigins[surface], `tenant ${tenantId} ${surface}`);
      const hostname = new URL(origin).hostname;
      if (hostnames.has(hostname))
        throw new Error(`duplicate tenant surface hostname: ${hostname}`);
      hostnames.add(hostname);
      origins[surface] = origin;
    }

    const cookieDomain = normalizeCookieDomain(
      tenant.cookieDomain,
      `tenant ${tenantId} cookieDomain`
    );
    if (cookieDomain !== null) {
      for (const origin of Object.values(origins)) {
        const hostname = new URL(origin).hostname;
        if (hostname !== cookieDomain && !hostname.endsWith(`.${cookieDomain}`)) {
          throw new Error(`cookieDomain ${cookieDomain} is not a parent of ${hostname}`);
        }
      }
    }
    const rawAliases = tenant.aliases === undefined ? {} : tenant.aliases;
    if (rawAliases === null || typeof rawAliases !== "object" || Array.isArray(rawAliases)) {
      throw new Error(`tenant ${tenantId} aliases must be an object`);
    }
    if (
      Object.keys(rawAliases).some((surface) => !SURFACES.includes(surface as TenantSurfaceName))
    ) {
      throw new Error(`tenant ${tenantId} aliases contains an unknown surface`);
    }
    const aliases: Partial<
      Record<TenantSurfaceName, readonly { origin: string; cookieDomain: string | null }[]>
    > = {};
    const tenantCookieDomains = cookieDomain === null ? [] : [cookieDomain];
    for (const surface of SURFACES) {
      const rawSurfaceAliases = (rawAliases as Record<string, unknown>)[surface] ?? [];
      if (!Array.isArray(rawSurfaceAliases)) {
        throw new Error(`tenant ${tenantId} aliases.${surface} must be an array`);
      }
      aliases[surface] = rawSurfaceAliases.map((rawAlias, aliasIndex) => {
        if (rawAlias === null || typeof rawAlias !== "object" || Array.isArray(rawAlias)) {
          throw new Error(`tenant ${tenantId} aliases.${surface}[${aliasIndex}] must be an object`);
        }
        const alias = rawAlias as Record<string, unknown>;
        if (Object.keys(alias).some((key) => key !== "origin" && key !== "cookieDomain")) {
          throw new Error(
            `tenant ${tenantId} aliases.${surface}[${aliasIndex}] has unknown fields`
          );
        }
        const origin = parseOrigin(
          alias.origin,
          `tenant ${tenantId} aliases.${surface}[${aliasIndex}].origin`
        );
        const aliasCookieDomain = normalizeCookieDomain(
          alias.cookieDomain,
          `tenant ${tenantId} aliases.${surface}[${aliasIndex}].cookieDomain`
        );
        const hostname = new URL(origin).hostname;
        if (hostnames.has(hostname)) {
          throw new Error(`duplicate tenant surface hostname: ${hostname}`);
        }
        hostnames.add(hostname);
        if (
          aliasCookieDomain !== null &&
          hostname !== aliasCookieDomain &&
          !hostname.endsWith(`.${aliasCookieDomain}`)
        ) {
          throw new Error(`cookieDomain ${aliasCookieDomain} is not a parent of ${hostname}`);
        }
        if (aliasCookieDomain !== null) tenantCookieDomains.push(aliasCookieDomain);
        return { origin, cookieDomain: aliasCookieDomain };
      });
    }
    cookieDomainsByTenant.push(tenantCookieDomains);
    return { tenantId, origins, cookieDomain, aliases };
  });

  for (let index = 0; index < cookieDomainsByTenant.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < cookieDomainsByTenant.length; otherIndex += 1) {
      for (const domain of cookieDomainsByTenant[index] ?? []) {
        for (const otherDomain of cookieDomainsByTenant[otherIndex] ?? []) {
          if (
            domain === otherDomain ||
            domain.endsWith(`.${otherDomain}`) ||
            otherDomain.endsWith(`.${domain}`)
          ) {
            throw new Error("tenant cookie domains must not overlap");
          }
        }
      }
    }
  }
  return { version: 1, tenants: bindings };
}

export function isTenantSurfaceOriginMapConfigured(): boolean {
  return Boolean(process.env[MAP_ENV]?.trim());
}

function readTenantSurfaceOriginMap(): TenantSurfaceOriginMap | null {
  const raw = process.env[MAP_ENV]?.trim();
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${MAP_ENV} must contain valid JSON`);
  }
  return validateTenantSurfaceOriginMap(parsed);
}

function normalizeIngressHostname(host: string): string {
  const normalizedHost = host.trim().toLowerCase();
  if (!normalizedHost) throw new Error("ingress host is required");
  if (normalizedHost.includes(",")) throw new Error("ingress host must contain one hostname");
  let url: URL;
  try {
    url = new URL(`https://${normalizedHost}`);
  } catch {
    throw new Error("ingress host is invalid");
  }
  if (
    url.username ||
    url.password ||
    (url.port.length > 0 && url.port !== "443") ||
    url.pathname !== "/"
  ) {
    throw new Error("ingress host must be a hostname without credentials or non-HTTPS port");
  }
  if (url.hostname.endsWith(".")) throw new Error("ingress host must not have a trailing dot");
  return url.hostname;
}

export function resolveTenantSurfaceBindingForHost(
  host: string,
  expectedSurface?: TenantSurfaceName
): TenantSurfaceBinding | null {
  const map = readTenantSurfaceOriginMap();
  if (map === null) return null;
  const hostname = normalizeIngressHostname(host);
  const binding = map.tenants.find((tenant) =>
    SURFACES.some(
      (surface) =>
        new URL(tenant.origins[surface]).hostname === hostname ||
        tenant.aliases?.[surface]?.some((alias) => new URL(alias.origin).hostname === hostname)
    )
  );
  if (binding === undefined) throw new Error(`tenant surface host is not allowlisted: ${hostname}`);
  const aliasSurface = SURFACES.find((surface) =>
    binding.aliases?.[surface]?.some((alias) => new URL(alias.origin).hostname === hostname)
  );
  const alias =
    aliasSurface === undefined
      ? undefined
      : binding.aliases?.[aliasSurface]?.find(
          (entry) => new URL(entry.origin).hostname === hostname
        );
  const matchesExpectedSurface =
    aliasSurface !== undefined
      ? aliasSurface === expectedSurface
      : expectedSurface === undefined ||
        new URL(binding.origins[expectedSurface]).hostname === hostname;
  if (expectedSurface !== undefined && !matchesExpectedSurface) {
    throw new Error(
      `tenant surface host does not match expected surface ${expectedSurface}: ${hostname}`
    );
  }
  return alias !== undefined ? { ...binding, cookieDomain: alias.cookieDomain } : binding;
}

export function resolveTenantSurfaceOriginFromHost(
  host: string,
  surface: TenantSurfaceName
): string | null {
  return resolveTenantSurfaceBindingForHost(host)?.origins[surface] ?? null;
}
