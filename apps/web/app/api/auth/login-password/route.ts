import { NextResponse } from "next/server";
import { decodeJwtPayload } from "@app-tour/session-client";
import {
  readPasswordIngressSecret,
  readPasswordClientIpConfig,
  resolvePasswordClientIp,
  signPasswordIngress,
} from "@app-tour/tenant-kernel/password-ingress-server";

import { bffCodedError } from "@/auth/bff-coded-error";
import { setSessionCookieOnResponse } from "@/auth/build-session-cookie";
import { buildIdentityBffHeadersAsync } from "@/auth/identity-bff-headers";
import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { resolveRequestHost } from "@/auth/resolve-request-host";
import { canonicalizeOperatorLoginPhone } from "@/features/auth/canonicalize-operator-login-phone";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

export async function POST(req: Request): Promise<NextResponse> {
  const host = resolveRequestHost(req);
  const origin = req.headers.get("origin");
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    new URL(req.url).protocol.replace(":", "");
  try {
    if (
      origin === null ||
      (proto !== "http" && proto !== "https") ||
      new URL(origin).origin !== new URL(`${proto}://${host}`).origin
    )
      return bffCodedError("ORIGIN_INVALID", 403);
  } catch {
    return bffCodedError("ORIGIN_INVALID", 403);
  }
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") ?? ""))
    return bffCodedError("PASSWORD_PAYLOAD_INVALID", 400);
  const raw = await req.json().catch(() => null);
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    return bffCodedError("PASSWORD_PAYLOAD_INVALID", 400);
  const body = raw as Record<string, unknown>;
  const mobile = canonicalizeOperatorLoginPhone(typeof body.phone === "string" ? body.phone : "");
  if (
    !/^\+?[0-9]{8,16}$/.test(mobile) ||
    typeof body.password !== "string" ||
    !body.password ||
    body.password.length > 512
  )
    return bffCodedError("PASSWORD_LOGIN_FAILED", 401);
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
    const upstream = await operatorApiFetch(`${resolveTourOpsApiBaseUrl()}/auth/login-password`, {
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
    if (typeof payload.sessionToken !== "string" || !payload.sessionToken)
      return bffCodedError("SESSION_TOKEN_MISSING", 502);
    if (decodeJwtPayload(payload.sessionToken)?.role !== "owner")
      return bffCodedError("AUTH_OWNER_PANEL_ONLY", 403);
    const response = NextResponse.json({ ok: true });
    setSessionCookieOnResponse(response.headers, payload.sessionToken);
    return response;
  } catch {
    return bffCodedError("BACKEND_UNREACHABLE", 502);
  }
}
