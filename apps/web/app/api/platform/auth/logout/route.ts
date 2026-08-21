import { NextResponse } from "next/server";

import { clearPlatformSessionCookieHeader } from "@/platform/build-platform-session-cookie";

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", clearPlatformSessionCookieHeader());
  return res;
}
