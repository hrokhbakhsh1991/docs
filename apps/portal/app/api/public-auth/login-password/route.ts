import { NextResponse } from "next/server";
import {
  classifyPublicRegistrationMobileInput,
  normalizePublicRegistrationMobile,
} from "@app-tour/catalog-registration-auth";
import {
  readPasswordIngressSecret,
  readPasswordClientIpConfig,
  resolvePasswordClientIp,
  signPasswordIngress,
} from "@app-tour/tenant-kernel/password-ingress-server";

import { bffCodedError } from "@/auth/bff-coded-error";
import { setSessionCookieOnResponse } from "@/auth/build-session-cookie";
import { buildIdentityBffHeadersAsync } from "@/auth/resolve-identity-bff-tenant";
import { resolveTourOpsApiBaseUrl } from "@/env";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

export function GET(): NextResponse {
  return NextResponse.json(
    {
      enabled:
        process.env.PASSWORD_AUTH_ENABLED?.trim() === "true" &&
        readPasswordIngressSecret() !== null &&
        readPasswordClientIpConfig() !== null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") ?? ""))
    return bffCodedError("PASSWORD_PAYLOAD_INVALID", 400);
  const raw = await req.json().catch(() => null);
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return bffCodedError("PASSWORD_PAYLOAD_INVALID", 400);
  const body = raw as Record<string, unknown>;
  const mobileCode = classifyPublicRegistrationMobileInput(body.phone);
  if (mobileCode !== null) return bffCodedError(mobileCode, 400);
  const mobile = normalizePublicRegistrationMobile(
    typeof body.phone === "string" ? body.phone : ""
  );
  if (typeof body.password !== "string" || body.password.length === 0 || body.password.length > 512)
    return bffCodedError("PASSWORD_LOGIN_FAILED", 401);
  const host = resolvePortalIngressHost(req);
  const candidateIp = req.headers.get("x-real-ip")?.trim() ?? "";
  const local = process.env.NODE_ENV !== "production" && /(^|\.)localhost(?::\d+)?$/.test(host);
  const ipConfig = readPasswordClientIpConfig();
  const peer = candidateIp || (local ? "127.0.0.1" : "");
  const ip =
    ipConfig === null
      ? null
      : resolvePasswordClientIp(peer, req.headers.get("ar-real-ip") ?? "", ipConfig);
  const secret = readPasswordIngressSecret();
  if (secret === null || ip === null) return bffCodedError("PASSWORD_RATE_LIMIT_UNAVAILABLE", 503);
  try {
    const headers = await buildIdentityBffHeadersAsync(req);
    const tenantId = headers["x-tenant-id"];
    if (!tenantId) return bffCodedError("PASSWORD_INGRESS_INVALID", 503);
    const timestamp = Date.now();
    const proof = signPasswordIngress({ tenantId, mobile, ip, timestamp }, secret);
    const upstream = await fetch(`${resolveTourOpsApiBaseUrl()}/public/auth/login-password`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "x-password-client-ip": ip,
        "x-password-client-time": String(timestamp),
        "x-password-client-proof": proof,
      },
      body: JSON.stringify({ mobile, password: body.password }),
      cache: "no-store",
    });
    const payload = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
    if (!upstream.ok)
      return bffCodedError(
        typeof payload.code === "string" ? payload.code : "PASSWORD_LOGIN_FAILED",
        upstream.status
      );
    if (typeof payload.sessionToken !== "string" || payload.sessionToken.length === 0)
      return bffCodedError("SESSION_TOKEN_MISSING", 502);
    const response = NextResponse.json({ ok: true });
    setSessionCookieOnResponse(response.headers, payload.sessionToken, host);
    return response;
  } catch {
    return bffCodedError("BACKEND_UNREACHABLE", 502);
  }
}
