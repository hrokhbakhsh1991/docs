import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";

function resolveBackendUrl(): string {
  return process.env.TOUR_OPS_API_URL?.trim() || "http://denali.localhost:3001";
}

type AcceptInviteBody = {
  invite_token?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as AcceptInviteBody;
  const inviteToken = typeof body.invite_token === "string" ? body.invite_token.trim() : "";
  if (!inviteToken) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message: "invite_token is required" } },
      { status: 400 }
    );
  }
  const sessionToken = cookies().get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (!sessionToken) {
    return NextResponse.json(
      { ok: false, error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }
  const backendRes = await fetch(`${resolveBackendUrl()}/api/v2/invites/accept`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: req.headers.get("host") ?? "",
      Authorization: `Bearer ${sessionToken}`
    },
    body: JSON.stringify({ inviteToken }),
    cache: "no-store"
  }).catch(() => null);
  if (!backendRes) {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }
  const payload = await backendRes.json().catch(() => ({}));
  if (!backendRes.ok) {
    return NextResponse.json({ ok: false, ...(payload as object) }, { status: backendRes.status });
  }
  return NextResponse.json({ ok: true, ...(payload as object) }, { status: 200 });
}
