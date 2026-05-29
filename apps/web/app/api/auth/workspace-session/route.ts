import { NextResponse } from "next/server";

import {
  SESSION_COOKIE_MAX_AGE_SECONDS,
  setSessionCookieOnResponse,
} from "@/lib/auth/build-session-cookie";
import { bffGuardErrorResponse } from "@/lib/api/bff-error-response";
import { bffFetchAuth } from "@/lib/api/bff-proxy";
import { getRequestIdFromHeaders } from "@/lib/api/tracing-utils";

type WorkspaceSessionBody = {
  tenant_id?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestIdFromHeaders(req.headers);
  const body = (await req.json().catch(() => ({}))) as WorkspaceSessionBody;
  const tenantId = typeof body.tenant_id === "string" ? body.tenant_id.trim() : "";
  if (!tenantId) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: "tenant_id is required",
          ...(requestId ? { requestId } : {}),
        },
      },
      { status: 400 },
    );
  }

  let backendRes: Response;
  try {
    backendRes = await bffFetchAuth(req, "/api/v2/auth/workspace/session", {
      method: "POST",
      body: JSON.stringify({ tenant_id: tenantId }),
    });
  } catch (e) {
    const guard = bffGuardErrorResponse(e, requestId);
    if (guard) {
      return guard;
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "BACKEND_UNREACHABLE",
          message: "Backend workspace session unavailable",
          ...(requestId ? { requestId } : {}),
        },
      },
      { status: 502 },
    );
  }

  const backendBody = (await backendRes.json().catch(() => ({}))) as {
    session_token?: unknown;
    user_id?: unknown;
    tenant_id?: unknown;
    entry_mode?: unknown;
    error?: { code?: string; message?: string };
  };
  const sessionToken =
    typeof backendBody.session_token === "string" ? backendBody.session_token.trim() : "";

  if (!backendRes.ok || !sessionToken) {
    const backendErrorCode = backendBody.error?.code ?? "AUTH_FAILED";
    const backendMessage = backendBody.error?.message ?? "Workspace session failed";
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: backendErrorCode,
          message: backendMessage,
          requestId: backendRes.headers.get("x-request-id") ?? requestId,
        },
      },
      { status: backendRes.status >= 400 ? backendRes.status : 403 },
    );
  }

  const userId = typeof backendBody.user_id === "string" ? backendBody.user_id.trim() : "";
  const resolvedTenantId =
    typeof backendBody.tenant_id === "string" ? backendBody.tenant_id.trim() : tenantId;

  const response = NextResponse.json(
    {
      ok: true,
      session_token: sessionToken,
      user_id: userId,
      tenant_id: resolvedTenantId,
      entry_mode: "web" as const,
    },
    { status: 200 },
  );
  /** 7-day persistent cookie — must align with JWT TTL issued by the backend. */
  setSessionCookieOnResponse(response, {
    token: sessionToken,
    maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
