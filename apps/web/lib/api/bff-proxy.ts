import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";
import { AppError, createAppError } from "@/lib/errors/app-error";
import { bffFetch } from "@/lib/api/bff-fetch";
import { bffGuardErrorResponse } from "@/lib/api/bff-error-response";
import { logBffError } from "@/lib/logging/bff-logger";

import { getRequestIdFromHeaders } from "@/lib/api/tracing-utils";

function extractSessionTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader?.trim()) {
    return null;
  }
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${SESSION_TOKEN_COOKIE}=([^;]+)`),
  );
  const raw = match?.[1]?.trim();
  if (!raw) {
    return null;
  }
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Resolves the workspace JWT for BFF upstream calls.
 * Prefer the incoming Route Handler `req` (curl/browser Cookie / Authorization),
 * then fall back to Next `cookies()` for same-origin client navigations.
 */
export function readSessionToken(req?: Request): string | null {
  if (req) {
    const authorization = req.headers.get("authorization")?.trim();
    if (authorization?.toLowerCase().startsWith("bearer ")) {
      const bearer = authorization.slice(7).trim();
      if (bearer) {
        return bearer;
      }
    }
    const fromRequestCookie = extractSessionTokenFromCookieHeader(req.headers.get("cookie"));
    if (fromRequestCookie) {
      return fromRequestCookie;
    }
  }

  const fromNextCookies = cookies().get(SESSION_TOKEN_COOKIE)?.value?.trim();
  return fromNextCookies || null;
}

/**
 * Forwards the caller session to Nest (Bearer + Cookie). Nest accepts either;
 * both improves tenant hydration when only one is present on the inbound request.
 */
function applyInboundSessionHeaders(req: Request, headers: Headers): string | null {
  const token = readSessionToken(req);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const inboundCookie = req.headers.get("cookie")?.trim();
  if (inboundCookie) {
    headers.set("Cookie", inboundCookie);
  } else if (token) {
    headers.set("Cookie", `${SESSION_TOKEN_COOKIE}=${encodeURIComponent(token)}`);
  }

  return token;
}

function extractRequestId(req: Request): string | undefined {
  return getRequestIdFromHeaders(req.headers);
}

export async function bffFetchAuth(
  req: Request,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = applyInboundSessionHeaders(req, headers);
  if (!token) {
    throw createAppError("AUTH_SESSION_INVALID", "Authentication required");
  }

  return bffFetch(req, path, { ...init, headers });
}

/**
 * Server-only catalog reads for BFF aggregation (tour detail gear/themes).
 * Sends `x-internal-api-key` so API {@link InternalApiKeyGuard} can elevate to admin read
 * while the user session still supplies tenant context via `Authorization`.
 */
export async function bffFetchWithInternalKey(
  req: Request,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const internalKey = process.env.INTERNAL_API_KEY?.trim();
  if (!internalKey) {
    throw createAppError(
      "BFF_CONFIG_MISSING",
      "INTERNAL_API_KEY is not configured for server-side catalog aggregation",
    );
  }
  const headers = new Headers(init.headers);
  headers.set("x-internal-api-key", internalKey);
  // Session headers (Authorization + Cookie) are applied inside bffFetchAuth.
  return bffFetchAuth(req, path, { ...init, headers });
}

function unauthorized(requestId?: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "AUTH_UNAUTHENTICATED",
        message: "Authentication required",
        ...(requestId ? { requestId } : {}),
      },
    },
    { status: 401 },
  );
}

function unreachable(requestId?: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "BACKEND_UNREACHABLE",
        message: "Backend unavailable",
        ...(requestId ? { requestId } : {}),
      },
    },
    { status: 502 },
  );
}

function invalidJsonBody(requestId?: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "INVALID_INPUT",
        message: "Request body must be JSON",
        ...(requestId ? { requestId } : {}),
      },
    },
    { status: 400 },
  );
}

function forwardSelectHeaders(backendRes: Response, out: NextResponse): void {
  const etag = backendRes.headers.get("etag");
  if (etag?.trim()) {
    out.headers.set("ETag", etag.trim());
    out.headers.set(
      "Cache-Control",
      backendRes.headers.get("cache-control") ?? "private, no-store",
    );
  }
  const apiLatency = backendRes.headers.get("x-api-latency");
  if (apiLatency?.trim()) {
    out.headers.set("x-api-latency", apiLatency.trim());
  }
  const dbLatency = backendRes.headers.get("x-db-latency");
  if (dbLatency?.trim()) {
    out.headers.set("x-db-latency", dbLatency.trim());
  }
  const traceparent = backendRes.headers.get("traceparent");
  if (traceparent?.trim()) {
    out.headers.set("traceparent", traceparent.trim());
  }
  const requestId = backendRes.headers.get("x-request-id");
  if (requestId?.trim()) {
    out.headers.set("x-request-id", requestId.trim());
  }
}

function forwardBffLatency(out: NextResponse, bffLatencyMs: number): void {
  out.headers.set("x-bff-latency", String(bffLatencyMs));
}

export async function proxyBffToNext(
  req: Request,
  path: string,
  init: RequestInit = {},
): Promise<NextResponse> {
  const requestId = extractRequestId(req);
  const bffStarted = Date.now();
  try {
    const backendRes = await bffFetchAuth(req, path, init);
    const bffLatencyMs = Date.now() - bffStarted;
    if (backendRes.status === 204) {
      const empty = new NextResponse(null, { status: 204 });
      forwardBffLatency(empty, bffLatencyMs);
      forwardSelectHeaders(backendRes, empty);
      return empty;
    }
    if (!backendRes.ok) {
      logBffError("proxy_upstream_non_ok", {
        requestId: backendRes.headers.get("x-request-id") ?? requestId,
        traceparent: backendRes.headers.get("traceparent") ?? undefined,
        endpoint: path,
        status: backendRes.status,
      });
    }
    const payload = await backendRes.json().catch(() => ({}));
    if (payload && typeof payload === "object" && payload.error && !payload.error.requestId && requestId) {
      payload.error.requestId = requestId;
    }
    const out = NextResponse.json(payload, { status: backendRes.status });
    forwardSelectHeaders(backendRes, out);
    forwardBffLatency(out, bffLatencyMs);
    return out;
  } catch (e) {
    const guard = bffGuardErrorResponse(e, requestId);
    if (guard) {
      forwardBffLatency(guard, Date.now() - bffStarted);
      return guard;
    }
    if (e instanceof AppError && e.code === "AUTH_SESSION_INVALID") {
      return unauthorized(requestId);
    }
    return unreachable(requestId);
  }
}

export async function proxyBffGet(req: Request, path: string): Promise<NextResponse> {
  return proxyBffToNext(req, path, { method: "GET" });
}

export async function proxyBffGetWithSearch(
  req: Request,
  basePath: string,
): Promise<NextResponse> {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const path = qs ? `${basePath}?${qs}` : basePath;
  return proxyBffGet(req, path);
}

function mutationHeadersFromRequest(req: Request): Headers {
  const headers = new Headers({ "Content-Type": "application/json" });
  const ifMatch = req.headers.get("if-match");
  const idempotencyKey = req.headers.get("idempotency-key");
  if (ifMatch?.trim()) {
    headers.set("If-Match", ifMatch.trim());
  }
  if (idempotencyKey?.trim()) {
    headers.set("Idempotency-Key", idempotencyKey.trim());
  }
  return headers;
}

export async function proxyBffPost(req: Request, path: string): Promise<NextResponse> {
  const requestId = extractRequestId(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return invalidJsonBody(requestId);
  }
  return proxyBffToNext(req, path, {
    method: "POST",
    headers: mutationHeadersFromRequest(req),
    body: JSON.stringify(body),
  });
}

/** Forwards multipart/form-data (e.g. receipt file upload) without re-encoding as JSON. */
export async function proxyBffPostMultipart(req: Request, path: string): Promise<NextResponse> {
  const formData = await req.formData();
  const headers = new Headers();
  const idempotencyKey = req.headers.get("idempotency-key");
  if (idempotencyKey?.trim()) {
    headers.set("Idempotency-Key", idempotencyKey.trim());
  }
  return proxyBffToNext(req, path, {
    method: "POST",
    headers,
    body: formData,
  });
}

export async function proxyBffPatch(req: Request, path: string): Promise<NextResponse> {
  const requestId = extractRequestId(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return invalidJsonBody(requestId);
  }
  return proxyBffToNext(req, path, {
    method: "PATCH",
    headers: mutationHeadersFromRequest(req),
    body: JSON.stringify(body),
  });
}

export async function proxyBffDelete(req: Request, path: string): Promise<NextResponse> {
  return proxyBffToNext(req, path, { method: "DELETE" });
}

/** Proxies binary GET (e.g. audit export CSV). */
export async function proxyBffGetBlob(req: Request, path: string): Promise<NextResponse> {
  const requestId = extractRequestId(req);
  const bffStarted = Date.now();
  try {
    const backendRes = await bffFetchAuth(req, path, { method: "GET" });
    const bffLatencyMs = Date.now() - bffStarted;
    if (!backendRes.ok) {
      const payload = await backendRes.json().catch(() => ({}));
      if (payload && typeof payload === "object" && payload.error && !payload.error.requestId && requestId) {
        payload.error.requestId = requestId;
      }
      return NextResponse.json(payload, { status: backendRes.status });
    }
    const blob = await backendRes.blob();
    const out = new NextResponse(blob, { status: backendRes.status });
    const contentType = backendRes.headers.get("content-type");
    if (contentType) {
      out.headers.set("Content-Type", contentType);
    }
    const disposition = backendRes.headers.get("content-disposition");
    if (disposition) {
      out.headers.set("Content-Disposition", disposition);
    }
    forwardSelectHeaders(backendRes, out);
    forwardBffLatency(out, bffLatencyMs);
    return out;
  } catch (e) {
    const guard = bffGuardErrorResponse(e, requestId);
    if (guard) {
      forwardBffLatency(guard, Date.now() - bffStarted);
      return guard;
    }
    if (e instanceof AppError && e.code === "AUTH_SESSION_INVALID") {
      return unauthorized(requestId);
    }
    return unreachable(requestId);
  }
}
