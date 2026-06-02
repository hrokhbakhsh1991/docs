import { NextResponse } from "next/server";
import { bffGuardErrorResponse } from "@/lib/api/bff-error-response";
import { bffFetchAuth, readSessionToken } from "@/lib/api/bff-proxy";

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
  if (!readSessionToken()) {
    return NextResponse.json(
      { ok: false, error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }
  let backendRes: Response;
  try {
    backendRes = await bffFetchAuth(req, "/api/v2/invites/accept", {
      method: "POST",
      body: JSON.stringify({ inviteToken }),
    });
  } catch (e) {
    const guard = bffGuardErrorResponse(e);
    if (guard) {
      return guard;
    }
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 },
    );
  }
  const payload = await backendRes.json().catch(() => ({}));
  if (!backendRes.ok) {
    return NextResponse.json({ ok: false, ...(payload as object) }, { status: backendRes.status });
  }
  return NextResponse.json({ ok: true, ...(payload as object) }, { status: 200 });
}
