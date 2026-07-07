import Link from "next/link";
import { headers } from "next/headers";

import { PlatformClubsTable } from "@/platform/platform-clubs-table";
import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

export const dynamic = "force-dynamic";

type TenantListResponse = {
  items?: Array<{
    id: string;
    subdomain: string;
    workspaceType: string;
    status: string;
  }>;
};

export default async function PlatformClubsPage() {
  const headerList = await headers();
  const req = new Request("http://platform.local/platform/clubs", {
    headers: { cookie: headerList.get("cookie") ?? "" },
  });
  const upstream = await proxyPlatformApi(req, "/platform/v1/tenants?limit=100&offset=0");
  const body = upstream.ok
    ? ((await upstream.json().catch(() => ({}))) as TenantListResponse)
    : {};
  const items = Array.isArray(body.items) ? body.items : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clubs</h1>
          <p className="text-sm text-muted-foreground">All provisioned tenants</p>
        </div>
        <Link
          href="/platform/clubs/new"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          New club
        </Link>
      </div>
      <PlatformClubsTable items={items} />
    </div>
  );
}
