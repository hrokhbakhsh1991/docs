import { NextResponse } from "next/server";

import { bffCodedError } from "@/auth/bff-coded-error";
import { mapPublicAuthBffCatchError } from "@/auth/public-auth-bff-error";
import { buildIdentityBffHeadersAsync } from "@/auth/resolve-identity-bff-tenant";
import { setSessionCookieOnResponse } from "@/auth/build-session-cookie";
import { resolveTourOpsApiBaseUrl } from "@/env";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

type RegisterCompleteBody = {
  onboarding_token?: unknown;
  display_name?: unknown;
  email?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as RegisterCompleteBody;
  const onboardingToken =
    typeof body.onboarding_token === "string" ? body.onboarding_token.trim() : "";
  const displayName =
    typeof body.display_name === "string" ? body.display_name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (onboardingToken.length === 0) {
    return bffCodedError("ONBOARDING_TOKEN_REQUIRED", 400);
  }
  if (displayName.length === 0) {
    return bffCodedError("DISPLAY_NAME_REQUIRED", 400);
  }

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await fetch(`${apiBase}/public/auth/register/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await buildIdentityBffHeadersAsync(req)),
      },
      body: JSON.stringify({
        onboardingToken,
        displayName,
        ...(email.length > 0 ? { email } : {}),
      }),
    });
  } catch (error) {
    return mapPublicAuthBffCatchError(error);
  }

  const backendBody = (await backendRes.json().catch(() => ({}))) as {
    sessionToken?: unknown;
    userId?: unknown;
    tenantId?: unknown;
    code?: unknown;
  };

  if (!backendRes.ok) {
    return bffCodedError(
      typeof backendBody.code === "string" ? backendBody.code : "REGISTRATION_FAILED",
      backendRes.status
    );
  }

  const sessionToken =
    typeof backendBody.sessionToken === "string" ? backendBody.sessionToken : "";
  if (sessionToken.length === 0) {
    return bffCodedError("SESSION_TOKEN_MISSING", 502);
  }

  const res = NextResponse.json(
    {
      ok: true,
      session_token: sessionToken,
      user_id: backendBody.userId,
      tenant_id: backendBody.tenantId,
    },
    { status: 200 }
  );
  setSessionCookieOnResponse(res.headers, sessionToken, resolvePortalIngressHost(req));
  return res;
}
