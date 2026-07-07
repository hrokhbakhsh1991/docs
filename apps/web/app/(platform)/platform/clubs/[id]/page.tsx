import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { PlatformClubDetailClient } from "@/platform/club-detail/platform-club-detail-client";
import { loadPlatformClubDetailFromResponse } from "@/platform/club-detail/load-platform-club-detail.server";
import { readPlatformOpsSessionFromCookies } from "@/platform/read-platform-session.server";
import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

export const dynamic = "force-dynamic";

export default async function PlatformClubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headerList = await headers();
  const req = new Request(`http://platform.local/platform/clubs/${id}`, {
    headers: { cookie: headerList.get("cookie") ?? "" },
  });
  const upstream = await proxyPlatformApi(req, `/platform/v1/tenants/${id}`);
  const detail = await loadPlatformClubDetailFromResponse(upstream);
  if (detail === null) {
    notFound();
  }

  const session = await readPlatformOpsSessionFromCookies();
  const opsRole = session?.role ?? "support";

  return (
    <div className="space-y-4">
      <Link href="/platform/clubs" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to clubs
      </Link>
      <PlatformClubDetailClient initialDetail={detail} opsRole={opsRole} />
    </div>
  );
}
