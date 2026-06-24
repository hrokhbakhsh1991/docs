import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { validateSessionToken } from "@app-tour/session-client";
import { resolveTourOpsApiBaseUrl } from "@/env";

type IdentityMePayload = {
  displayName?: unknown;
  email?: unknown;
  mobile?: unknown;
};

export async function GET(req: Request): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { ok: false, error: { code: "AUTH_UNAUTHENTICATED" } },
      { status: 401 }
    );
  }

  const validation = validateSessionToken(sessionToken);
  if (validation.status !== "valid") {
    return NextResponse.json(
      { ok: false, error: { code: "AUTH_UNAUTHENTICATED" } },
      { status: 401 }
    );
  }

  let backendRes: Response;
  try {
    const host = req.headers.get("host") ?? "localhost:3003";
    backendRes = await fetch(`${resolveTourOpsApiBaseUrl()}/identity/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: host.split(":")[0] ?? host,
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE" } },
      { status: 502 }
    );
  }

  const payload = (await backendRes.json().catch(() => ({}))) as IdentityMePayload;
  if (!backendRes.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: typeof payload === "object" && payload !== null && "code" in payload
            ? String((payload as { code?: unknown }).code)
            : "PROFILE_FETCH_FAILED",
        },
      },
      { status: backendRes.status }
    );
  }

  const displayName =
    typeof payload.displayName === "string" ? payload.displayName.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const mobile = typeof payload.mobile === "string" ? payload.mobile.trim() : "";

  return NextResponse.json(
    {
      ok: true,
      display_name: displayName.length > 0 ? displayName : mobile,
      email: email.length > 0 ? email : null,
    },
    { status: 200 }
  );
}
