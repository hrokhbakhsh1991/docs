import { NextResponse } from "next/server";

import { bffCodedError } from "@/auth/bff-coded-error";
import { setSessionCookieOnResponse } from "@/auth/build-session-cookie";
import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveRequestHost } from "@/auth/resolve-request-host";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type Action = "status" | "request-otp" | "set";

function sameOrigin(req: Request, host: string): boolean {
  const origin = req.headers.get("origin");
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    new URL(req.url).protocol.replace(":", "");
  if (origin === null || (proto !== "http" && proto !== "https")) return false;
  try {
    return new URL(origin).origin === new URL(`${proto}://${host}`).origin;
  } catch {
    return false;
  }
}

export async function forwardOperatorPassword(req: Request, action: Action): Promise<NextResponse> {
  const host = resolveRequestHost(req);
  if (action !== "status" && !sameOrigin(req, host)) return bffCodedError("ORIGIN_INVALID", 403);
  const session = readSessionTokenFromRequest(req);
  if (session === null) return bffCodedError("AUTH_UNAUTHENTICATED", 401);
  let body: string | undefined;
  if (action === "set") {
    const raw = await req.json().catch(() => null);
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
      return bffCodedError("PASSWORD_PAYLOAD_INVALID", 400);
    const input = raw as Record<string, unknown>;
    if (
      typeof input.challenge_id !== "string" ||
      input.challenge_id.length > 64 ||
      typeof input.otp !== "string" ||
      input.otp.length > 8 ||
      typeof input.password !== "string" ||
      input.password.length > 512
    ) {
      return bffCodedError("PASSWORD_PAYLOAD_INVALID", 400);
    }
    body = JSON.stringify({
      challengeId: input.challenge_id,
      code: input.otp,
      password: input.password,
    });
  }
  try {
    const backendRes = await operatorApiFetch(
      `${resolveTourOpsApiBaseUrl()}/identity/me/password${action === "request-otp" ? "/request-otp" : ""}`,
      {
        method: action === "status" ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${session}`,
          host: host.split(":")[0] ?? host,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body } : {}),
        cache: "no-store",
      }
    );
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!backendRes.ok)
      return bffCodedError(
        typeof payload.code === "string" ? payload.code : "PASSWORD_REQUEST_FAILED",
        backendRes.status
      );
    if (action === "status") {
      if (typeof payload.hasPassword !== "boolean")
        return bffCodedError("PASSWORD_REQUEST_FAILED", 502);
      return NextResponse.json({ ok: true, has_password: payload.hasPassword });
    }
    if (action === "request-otp") {
      if (
        typeof payload.challengeId !== "string" ||
        (payload.otpLength !== 4 && payload.otpLength !== 6)
      )
        return bffCodedError("OTP_REQUEST_FAILED", 502);
      return NextResponse.json({
        ok: true,
        challenge_id: payload.challengeId,
        otp_length: payload.otpLength,
      });
    }
    if (typeof payload.sessionToken !== "string" || payload.sessionToken.length === 0)
      return bffCodedError("SESSION_TOKEN_MISSING", 502);
    const res = NextResponse.json({ ok: true });
    setSessionCookieOnResponse(res.headers, payload.sessionToken);
    return res;
  } catch {
    return bffCodedError("BACKEND_UNREACHABLE", 502);
  }
}
