import { NextResponse } from "next/server";

import { clearSessionCookieOnResponse } from "@/auth/build-session-cookie";

const BACKEND_INVALID_BEARER_CODES = new Set([
  "UNAUTHORIZED_INVALID_BEARER_TOKEN",
  "AUTH_JWT_REQUIRED_IN_PRODUCTION",
]);

function shouldClearSessionOnBackendAuthFailure(
  status: number,
  payload: Record<string, unknown>
): boolean {
  if (status !== 401 && status !== 403) {
    return false;
  }
  const code =
    (typeof payload.code === "string" ? payload.code : undefined) ??
    (typeof payload.error === "object" &&
    payload.error !== null &&
    typeof (payload.error as { code?: unknown }).code === "string"
      ? (payload.error as { code: string }).code
      : undefined);
  return code !== undefined && BACKEND_INVALID_BEARER_CODES.has(code);
}

export function proxyBackendJsonResponse(
  payload: Record<string, unknown>,
  status: number
): NextResponse {
  const response = NextResponse.json(payload, { status });
  if (shouldClearSessionOnBackendAuthFailure(status, payload)) {
    clearSessionCookieOnResponse(response.headers);
  }
  return response;
}
