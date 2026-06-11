import { NextResponse } from "next/server";

import { clearSessionCookieOnResponse } from "@/auth/build-session-cookie";
import { clearOperatorWelcomeArmedCookieOnResponse } from "@/auth/operator-welcome-cookie";

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  clearSessionCookieOnResponse(res.headers);
  clearOperatorWelcomeArmedCookieOnResponse(res.headers);
  return res;
}
