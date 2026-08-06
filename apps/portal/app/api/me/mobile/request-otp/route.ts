import { NextResponse } from "next/server";

import {
  classifyPublicRegistrationMobileInput,
  normalizePublicRegistrationMobile,
} from "@app-tour/catalog-registration-auth";

import { bffCodedError } from "@/auth/bff-coded-error";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolveTourOpsApiBaseUrl } from "@/env";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

type RequestOtpBody = {
  phone?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return bffCodedError("AUTH_UNAUTHENTICATED", 401);
  }

  const body = (await req.json().catch(() => ({}))) as RequestOtpBody;
  const mobileCode = classifyPublicRegistrationMobileInput(body.phone);
  if (mobileCode !== null) {
    return bffCodedError(mobileCode, 400);
  }
  const phone = normalizePublicRegistrationMobile(
    typeof body.phone === "string" ? body.phone.trim() : ""
  );

  const ingressHost = host.split(":")[0] ?? host;

  try {
    const backendRes = await fetch(`${resolveTourOpsApiBaseUrl()}/identity/me/mobile/request-otp`, {
      method: "POST",
      headers: {
        ...headers,
        host: ingressHost,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mobile: phone }),
      cache: "no-store",
    });
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!backendRes.ok) {
      return bffCodedError(
        typeof payload.code === "string" ? payload.code : "OTP_REQUEST_FAILED",
        backendRes.status
      );
    }
    return NextResponse.json(
      {
        ok: true,
        challenge_id: payload.challengeId,
      },
      { status: 200 }
    );
  } catch {
    return bffCodedError("BACKEND_UNREACHABLE", 502);
  }
}
