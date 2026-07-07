import { countUnhealthyFromSitesCheckBody } from "@/platform/count-unhealthy-from-sites-check";

const DEFAULT_HEALTH_CHECK_LIMIT = 25;

export type PlatformOverviewTenantItem = {
  readonly id?: string;
  readonly status: string;
};

export type SitesCheckBody = {
  readonly results?: unknown;
};

export function readOverviewHealthCheckLimit(input?: string): number {
  const raw = input ?? process.env.PLATFORM_OVERVIEW_HEALTH_CHECK_LIMIT?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_HEALTH_CHECK_LIMIT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_HEALTH_CHECK_LIMIT;
  }
  return parsed;
}

export async function aggregateUnhealthySiteCount(
  items: readonly PlatformOverviewTenantItem[],
  fetchSitesCheck: (tenantId: string) => Promise<SitesCheckBody | null>,
  limit = readOverviewHealthCheckLimit()
): Promise<number> {
  const activeIds = items
    .filter((item) => item.status === "active" && typeof item.id === "string" && item.id.length > 0)
    .slice(0, limit)
    .map((item) => item.id as string);

  if (activeIds.length === 0) {
    return 0;
  }

  const counts = await Promise.all(
    activeIds.map(async (tenantId) => {
      const body = await fetchSitesCheck(tenantId);
      if (body === null) {
        return 0;
      }
      return countUnhealthyFromSitesCheckBody(body);
    })
  );

  return counts.reduce((sum, count) => sum + count, 0);
}
