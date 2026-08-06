import { NextResponse } from "next/server";

import {
  classifyPublicRegistrationMobileInput,
  normalizePublicRegistrationMobile,
} from "@app-tour/catalog-registration-auth";

import { bffCodedError } from "@/auth/bff-coded-error";
import { setSessionCookieOnResponse } from "@/auth/build-session-cookie";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { invalidateMemberProfileViewForMember } from "@/me/member-profile-cache.server";
import { resolveTourOpsApiBaseUrl } from "@/env";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

function readSessionUserId(headers: Record<string, string>): string | null {
  const userId = headers["x-user-id"];
  return userId !== undefined && userId.trim().length > 0 ? userId.trim() : null;
}

/** Best-effort INV-MP-CACHE-01 — must not mask a successful upstream mutation. */
async function invalidateAfterMobileVerify(
  host: string,
  headers: Record<string, string>
): Promise<void> {
  try {
    const sessionUserId = readSessionUserId(headers);
    if (sessionUserId === null) {
      return;
    }
    const bootstrap = await resolvePortalBootstrapForHost(host);
    invalidateMemberProfileViewForMember({
      tenantId: bootstrap.tenantId,
      userId: sessionUserId,
      pluginId: bootstrap.pluginId,
    });
  } catch {
    // Upstream mobile change already committed; avoid turning OK into 502.
  }
}

type VerifyBody = {
  phone?: unknown;
  otp?: unknown;
  challenge_id?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return bffCodedError("AUTH_UNAUTHENTICATED", 401);
  }

  const body = (await req.json().catch(() => ({}))) as VerifyBody;
  const mobileCode = classifyPublicRegistrationMobileInput(body.phone);
  if (mobileCode !== null) {
    return bffCodedError(mobileCode, 400);
  }
  const phone = normalizePublicRegistrationMobile(
    typeof body.phone === "string" ? body.phone.trim() : ""
  );
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  const challengeId =
    typeof body.challenge_id === "string" ? body.challenge_id.trim() : "";

  if (otp.length === 0 || challengeId.length === 0) {
    return bffCodedError("OTP_PAYLOAD_INVALID", 400);
  }

  const ingressHost = host.split(":")[0] ?? host;

  try {
    const backendRes = await fetch(`${resolveTourOpsApiBaseUrl()}/identity/me/mobile/verify`, {
      method: "POST",
      headers: {
        ...headers,
        host: ingressHost,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mobile: phone,
        code: otp,
        challengeId,
      }),
      cache: "no-store",
    });
    const payload = (await backendRes.json().catch(() => ({}))) as {
      code?: unknown;
      sessionToken?: unknown;
      profile?: { mobile?: unknown };
    };
    if (!backendRes.ok) {
      return bffCodedError(
        typeof payload.code === "string" ? payload.code : "MOBILE_CHANGE_FAILED",
        backendRes.status
      );
    }

    // Invalidate as soon as upstream confirms — even if session cookie refresh fails.
    await invalidateAfterMobileVerify(host, headers);

    const sessionToken =
      typeof payload.sessionToken === "string" ? payload.sessionToken.trim() : "";
    if (sessionToken.length === 0) {
      return bffCodedError("SESSION_TOKEN_MISSING", 502);
    }

    const res = NextResponse.json(
      {
        ok: true,
        mobile:
          typeof payload.profile?.mobile === "string" ? payload.profile.mobile : phone,
      },
      { status: 200 }
    );
    setSessionCookieOnResponse(res.headers, sessionToken, host);
    return res;
  } catch {
    return bffCodedError("BACKEND_UNREACHABLE", 502);
  }
}
