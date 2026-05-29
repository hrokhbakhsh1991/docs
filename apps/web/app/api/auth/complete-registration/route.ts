import { NextResponse } from "next/server";
import {
  buildSessionCookieOptions,
  SESSION_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/auth/build-session-cookie";
import { bffFetch } from "@/lib/api/bff-fetch";
import { bffGuardErrorResponse } from "@/lib/api/bff-error-response";

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

  let backendRes: Response;
  try {
    backendRes = await bffFetch(req, "/api/v2/auth/web/registration/complete", {
      method: "POST",
      body: JSON.stringify({
        onboarding_token: onboardingToken,
        full_name: fullName,
        ...(email ? { email } : {}),
      }),
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
  response.cookies.set(
    buildSessionCookieOptions({
      token: sessionToken,
      maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SECONDS,
    }),
  );
  return response;
}
