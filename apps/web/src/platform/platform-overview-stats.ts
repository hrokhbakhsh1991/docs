export type PlatformTenantListItem = {
  readonly subdomain: string;
  readonly status: string;
};

export type PlatformOverviewStats = {
  readonly total: number;
  readonly active: number;
  readonly suspended: number;
  readonly unhealthyCount: number;
  readonly sslExpiringWithin14Days: number;
};

export function computePlatformOverviewStats(
  items: readonly PlatformTenantListItem[],
  unhealthyCount = 0,
  sslExpiringWithin14Days = 0
): PlatformOverviewStats {
  let active = 0;
  let suspended = 0;
  for (const item of items) {
    if (item.status === "suspended") {
      suspended += 1;
    } else if (item.status === "active") {
      active += 1;
    }
  }
  return {
    total: items.length,
    active,
    suspended,
    unhealthyCount,
    sslExpiringWithin14Days,
  };
}
