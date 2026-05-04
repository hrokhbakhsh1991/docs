import { NextResponse } from "next/server";
import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_TOKEN_COOKIE,
    value: "",
    path: "/",
    httpOnly: false,
    sameSite: "strict",
    expires: new Date(0)
  });
  return response;
}
