import { headers } from "next/headers";

import { loadPlatformOverviewStats } from "@/platform/load-platform-overview-stats.server";

export const dynamic = "force-dynamic";

export default async function PlatformOverviewPage() {
  const headerList = await headers();
  const req = new Request("http://platform.local/platform", {
    headers: { cookie: headerList.get("cookie") ?? "" },
  });
  const stats = await loadPlatformOverviewStats(req);

  return (
    <div className="space-y-6" data-platform-overview>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Platform-wide club metrics</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total clubs" value={stats.total} testId="data-stat-total" />
        <StatCard label="Active" value={stats.active} testId="data-stat-active" />
        <StatCard label="Suspended" value={stats.suspended} testId="data-stat-suspended" />
        <StatCard label="Unhealthy sites" value={stats.unhealthyCount} testId="data-stat-unhealthy" />
        <StatCard
          label="SSL expiring (14d)"
          value={stats.sslExpiringWithin14Days}
          testId="data-stat-ssl-expiring"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  testId,
}: {
  label: string;
  value: number;
  testId: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid={testId}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}
