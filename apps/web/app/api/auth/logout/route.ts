import { NextResponse } from "next/server";
import { buildClearSessionCookieOptions } from "@/lib/auth/build-session-cookie";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(buildClearSessionCookieOptions());
  return response;
}
