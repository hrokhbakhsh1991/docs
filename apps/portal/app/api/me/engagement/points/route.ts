import { NextResponse } from "next/server";

import { fetchMemberEngagementPointHistory } from "@/me/engagement/member-engagement-bff.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const host = await readPortalIngressHost();
  const url = new URL(request.url);
  const limit = url.searchParams.get("limit");
  const result = await fetchMemberEngagementPointHistory(host);
  if (!result.ok) {
    return NextResponse.json({ ok: false, code: result.code }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    items: result.items,
    ...(limit !== null ? { limit } : {}),
  });
}
