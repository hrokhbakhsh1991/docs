import { buildDevMarketingPublicBaseUrl } from "@app-tour/tenant-kernel/host-only";

import { readPlatformRootDomain } from "../../platform/read-platform-root-domain";
import { resolveRegisteredTenantById } from "../../tenant/resolve-registered-tenant";

function resolveConfiguredMarketingBaseUrl(): string | null {
  const configured = process.env.MARKETING_PUBLIC_BASE_URL?.trim();
  if (configured === undefined || configured.length === 0) {
    return null;
  }
  try {
    const parsed = new URL(configured);
    if (process.env.NODE_ENV === "production") {
      const allowlist = (process.env.MARKETING_PUBLIC_BASE_URL_ALLOWLIST ?? "")
        .split(",")
        .map((value) => value.trim().replace(/\/$/, ""))
        .filter(Boolean);
      if (parsed.protocol !== "https:" || !allowlist.includes(configured.replace(/\/$/, ""))) {
        return null;
      }
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.port) {
      return null;
    }
    return configured.replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * Builds the anonymous public PDP URL used by TourPublished Telegram messages.
 * The URL is resolved at delivery time so staging and production never share
 * an environment-specific host in the persisted event snapshot.
 */
export async function resolveTourPublishedPdpUrl(input: {
  readonly tenantId: string;
  readonly tourId: string;
}): Promise<string | null> {
  const tourId = input.tourId.trim();
  if (tourId.length === 0) {
    return null;
  }

  const tenant = await resolveRegisteredTenantById(input.tenantId);
  if (tenant === null || tenant.subdomain.trim().length === 0) {
    return null;
  }

  const configuredBase = resolveConfiguredMarketingBaseUrl();
  if (process.env.NODE_ENV === "production" && configuredBase === null) {
    return null;
  }
  let base = configuredBase;
  if (base === null) {
    let rootDomain: string;
    try {
      rootDomain = readPlatformRootDomain();
    } catch {
      return null;
    }
    base = buildDevMarketingPublicBaseUrl({
      ingressHost: `${tenant.subdomain}.${rootDomain}`,
      rootDomain,
      marketingPort: process.env.MARKETING_DEV_PORT?.trim() || "3002",
    });
  }
  return `${base.replace(/\/$/, "")}/tours/${encodeURIComponent(tourId)}`;
}
