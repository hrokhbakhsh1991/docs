import { NextResponse } from "next/server";

import { clearSessionCookieOnResponse } from "@/auth/build-session-cookie";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

/** Member session logout — clears `atour_mb_session` only (no API revoke). */
export async function POST(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const res = NextResponse.json({ ok: true });
  clearSessionCookieOnResponse(res.headers, host);
  return res;
}
