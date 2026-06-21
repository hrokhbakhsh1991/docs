import { buildClubSiteUrls } from "./build-club-site-urls.ts";

export type TenantDomainRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly hostname: string;
  readonly surface: string;
  readonly status: string;
  readonly cnameTarget: string;
  readonly createdAt: Date;
  readonly verifiedAt: Date | null;
  readonly sslStatus: string;
  readonly sslExpiresAt: Date | null;
  readonly sslLastError: string | null;
  readonly lastObservedCname: string | null;
};

export type TenantDomainDto = {
  readonly id: string;
  readonly tenantId: string;
  readonly hostname: string;
  readonly surface: string;
  readonly status: string;
  readonly cnameTarget: string;
  readonly createdAt: string;
  readonly verifiedAt: string | null;
  readonly sslStatus: "pending" | "provisioning" | "active" | "failed";
  readonly sslExpiresAt: string | null;
  readonly sslLastError: string | null;
};

export function buildTenantDomainCnameTarget(subdomain: string, surface: "marketing" | "portal"): string {
  const urls = buildClubSiteUrls(subdomain);
  if (surface === "portal") {
    return new URL(urls.portal).hostname;
  }
  return new URL(urls.marketing).hostname;
}

export function toTenantDomainDto(row: TenantDomainRecord): TenantDomainDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    hostname: row.hostname,
    surface: row.surface,
    status: row.status,
    cnameTarget: row.cnameTarget,
    createdAt: row.createdAt.toISOString(),
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    sslStatus: row.sslStatus as TenantDomainDto["sslStatus"],
    sslExpiresAt: row.sslExpiresAt?.toISOString() ?? null,
    sslLastError: row.sslLastError ?? null,
  };
}
