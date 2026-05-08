import { NextResponse } from "next/server";
import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";

function resolveBackendUrl(): string {
  return process.env.TOUR_OPS_API_URL?.trim() || "http://denali.localhost:3001";
}

function secureCookieEnabled(): boolean {
  return process.env.NODE_ENV === "production";
}

type CompleteRegistrationBody = {
  onboarding_token?: unknown;
  full_name?: unknown;
  email?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as CompleteRegistrationBody;
  const onboardingToken =
    typeof body.onboarding_token === "string" ? body.onboarding_token.trim() : "";
  const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : undefined;
  if (!onboardingToken || !fullName) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: "onboarding_token and full_name are required"
        }
      },
      { status: 400 }
    );
  }

  const backendRes = await fetch(`${resolveBackendUrl()}/api/v2/auth/web/registration/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: req.headers.get("host") ?? ""
    },
    body: JSON.stringify({
      onboarding_token: onboardingToken,
      full_name: fullName,
      ...(email ? { email } : {})
    }),
    cache: "no-store"
  }).catch(() => null);

  if (!backendRes) {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }

  const payload = (await backendRes.json().catch(() => ({}))) as {
    session_token?: unknown;
    error?: { code?: string; message?: string };
  };
  const sessionToken = typeof payload.session_token === "string" ? payload.session_token.trim() : "";
  if (!backendRes.ok || !sessionToken) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: payload.error?.code ?? "REGISTRATION_COMPLETE_FAILED",
          message: payload.error?.message ?? "Registration completion failed"
        }
      },
      { status: backendRes.status === 400 ? 400 : 401 }
    );
  }

  const response = NextResponse.json({ ok: true, ...(payload as object) }, { status: 200 });
  response.cookies.set({
    name: SESSION_TOKEN_COOKIE,
    value: sessionToken,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookieEnabled()
  });
  return response;
}
