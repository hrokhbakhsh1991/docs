import { NextResponse } from "next/server";

import { resolveTourOpsApiBaseUrl } from "@/env";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import type { MemberRegistrationItem } from "@/me/fetch-member-registrations.server";

type BookingsMineResponse = {
  readonly items?: readonly MemberRegistrationItem[];
};

export async function GET(req: Request): Promise<NextResponse> {
  const host = req.headers.get("host") ?? "localhost:3003";
  const headers = await buildMemberApiHeaders(host);

  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const res = await fetch(`${resolveTourOpsApiBaseUrl()}/bookings?view=mine&limit=50`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ ok: true, data: { items: [] } }, { status: 200 });
  }

  const payload = (await res.json()) as BookingsMineResponse;
  const items = [...(payload.items ?? [])];
  return NextResponse.json({ ok: true, data: { items } }, { status: 200 });
}
