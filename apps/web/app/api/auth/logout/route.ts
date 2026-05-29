import { NextResponse } from "next/server";
import { clearAllSessionCookiesOnResponse } from "@/lib/auth/build-session-cookie";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  clearAllSessionCookiesOnResponse(response);
  return response;
}
