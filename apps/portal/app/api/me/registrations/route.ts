import { NextResponse } from "next/server";

import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { fetchMemberRegistrations } from "@/me/fetch-member-registrations.server";

export async function GET(req: Request): Promise<NextResponse> {
  const host = req.headers.get("host") ?? "localhost:3003";
  const headers = await buildMemberApiHeaders(host);

  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const items = await fetchMemberRegistrations(host);
  return NextResponse.json({ ok: true, data: { items } }, { status: 200 });
}
