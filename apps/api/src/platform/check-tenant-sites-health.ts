import { buildClubSiteUrls } from "./build-club-site-urls.ts";
import { PlatformTenantRepository } from "./platform-tenant.repository.ts";

export const SITE_HEALTH_CHECK_TIMEOUT_MS = 5000;

export type SiteHealthResult = {
  readonly url: string;
  readonly ok: boolean;
  readonly status: number | null;
};

export type TenantSitesCheckResult = {
  readonly marketing: SiteHealthResult;
  readonly portal: SiteHealthResult;
  readonly admin: SiteHealthResult;
};

type HeadCheckOptions = {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
};

async function headCheck(url: string, options: HeadCheckOptions = {}): Promise<SiteHealthResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? SITE_HEALTH_CHECK_TIMEOUT_MS;
  try {
    const response = await fetchImpl(url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      url,
      ok: response.status > 0 && response.status < 500,
      status: response.status,
    };
  } catch {
    return { url, ok: false, status: null };
  }
}

export async function headCheckSiteHealth(
  url: string,
  options: HeadCheckOptions = {}
): Promise<SiteHealthResult> {
  return headCheck(url, options);
}

export async function checkTenantSitesHealth(
  tenantId: string,
  deps: { repository?: PlatformTenantRepository } = {}
): Promise<TenantSitesCheckResult | null> {
  const repository = deps.repository ?? new PlatformTenantRepository();
  const tenant = await repository.getById(tenantId);
  if (!tenant) {
    return null;
  }
  const urls = buildClubSiteUrls(tenant.subdomain);
  const [marketing, portal, admin] = await Promise.all([
    headCheck(urls.marketing),
    headCheck(urls.portal),
    headCheck(urls.admin),
  ]);
  return { marketing, portal, admin };
}

export function countUnhealthySiteChecks(result: TenantSitesCheckResult): number {
  let unhealthy = 0;
  if (!result.marketing.ok) unhealthy += 1;
  if (!result.portal.ok) unhealthy += 1;
  if (!result.admin.ok) unhealthy += 1;
  return unhealthy;
}
