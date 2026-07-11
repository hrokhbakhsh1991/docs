import { computePlatformOverviewStats } from "@/platform/platform-overview-stats";
import { aggregateUnhealthySiteCount, type SitesCheckBody } from "@/platform/platform-overview-aggregation";
import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

type TenantListResponse = {
  items?: Array<{ id?: string; subdomain: string; status: string }>;
};

export async function loadPlatformOverviewStats(req: Request) {
  const upstream = await proxyPlatformApi(req, "/platform/v1/tenants?limit=100&offset=0");
  if (!upstream.ok) {
    return computePlatformOverviewStats([]);
  }
  const body = (await upstream.json().catch(() => ({}))) as TenantListResponse;
  const items = Array.isArray(body.items) ? body.items : [];
  const unhealthyCount = await aggregateUnhealthySiteCount(items, async (tenantId) => {
    const check = await proxyPlatformApi(req, `/platform/v1/tenants/${tenantId}/sites/check`);
    if (!check.ok) {
      return null;
    }
    return (await check.json().catch(() => ({}))) as SitesCheckBody;
  });
  const sslUpstream = await proxyPlatformApi(req, "/platform/v1/domains/ssl-summary");
  const sslBody = sslUpstream.ok
    ? ((await sslUpstream.json().catch(() => ({}))) as { expiringWithin14Days?: number })
    : {};
  const sslExpiringWithin14Days =
    typeof sslBody.expiringWithin14Days === "number" ? sslBody.expiringWithin14Days : 0;
  return computePlatformOverviewStats(items, unhealthyCount, sslExpiringWithin14Days);
}
