import { NextResponse } from "next/server";

import { clearSessionCookieOnResponse } from "@/auth/build-session-cookie";

/** Member session logout — clears `atour_mb_session` only (no API revoke). */
export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  clearSessionCookieOnResponse(res.headers);
  return res;
}
