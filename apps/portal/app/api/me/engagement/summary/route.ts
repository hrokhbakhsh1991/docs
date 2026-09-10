import { NextResponse } from "next/server";

import { fetchMemberEngagementSummary } from "@/me/engagement/member-engagement-bff.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const host = await readPortalIngressHost();
  const result = await fetchMemberEngagementSummary(host);
  if (!result.ok) {
    return NextResponse.json({ ok: false, code: result.code }, { status: result.status });
  }
  return NextResponse.json({ ok: true, summary: result.view });
}
