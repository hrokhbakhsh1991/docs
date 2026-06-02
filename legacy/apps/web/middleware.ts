import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { clearAllSessionCookiesOnResponse } from "./lib/auth/build-session-cookie";
import { pickSessionTokenFromRequestCookies } from "./lib/auth/resolve-session-cookie";
import {
  authAuditHeaderValue,
  AUTH_AUDIT_REQUEST_HEADER,
  formatAuthAuditLabel,
  validateSessionToken,
} from "./lib/auth/validate-session-token";
import { lookupWorkspaceTenantExists } from "./lib/tenant/lookup-workspace-tenant";
import { resolveInboundHostname } from "./lib/tenant/trusted-forwarded-host";
import { resolveTenantSlugFromHost } from "./lib/tenant/runtime-tenant-context";
import { evaluateWorkspaceHost, isBareApexHost } from "./lib/tenant/workspace-host-policy";
import { routing } from "./src/i18n/routing";

import { WORKSPACE_ASSERT_SKIP_HEADER } from "./lib/tenant/workspace-assert-skip";

const PROBE_RATE_WINDOW_MS = Number(process.env.WORKSPACE_PROBE_RATE_WINDOW_MS ?? "60000");
const PROBE_RATE_MAX_PER_IP = Number(process.env.WORKSPACE_PROBE_RATE_MAX_PER_IP ?? "120");
const PROBE_HIT_SWEEP_EVERY = 256;
const probeHitsByIp = new Map<string, { count: number; windowStart: number }>();
let probeHitChecks = 0;

function pruneColdProbeHits(now: number): void {
  for (const [ip, entry] of probeHitsByIp) {
    if (now - entry.windowStart >= PROBE_RATE_WINDOW_MS) {
      probeHitsByIp.delete(ip);
    }
  }
}

function isProbeRateLimited(ip: string | undefined): boolean {
  if (!ip?.trim() || !Number.isFinite(PROBE_RATE_WINDOW_MS) || !Number.isFinite(PROBE_RATE_MAX_PER_IP)) {
    return false;
  }
  const now = Date.now();
  probeHitChecks += 1;
  if (probeHitChecks % PROBE_HIT_SWEEP_EVERY === 0) {
    pruneColdProbeHits(now);
  }
  const entry = probeHitsByIp.get(ip);
  if (!entry || now - entry.windowStart >= PROBE_RATE_WINDOW_MS) {
    if (entry && now - entry.windowStart >= PROBE_RATE_WINDOW_MS) {
      probeHitsByIp.delete(ip);
    }
    probeHitsByIp.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > PROBE_RATE_MAX_PER_IP;
}

function inboundHost(request: NextRequest): string | null {
  return resolveInboundHostname(request.headers, { remoteIp: request.ip });
}

async function isKnownWorkspaceSlug(slug: string): Promise<boolean> {
  return lookupWorkspaceTenantExists(slug.trim().toLowerCase());
}

function forwardTenantSlug(
  request: NextRequest,
  response: NextResponse,
  extraRequestHeaders?: Record<string, string>,
): NextResponse {
  const slug = resolveTenantSlugFromHost(request.headers.get("host"));
  const requestHeaders = new Headers(request.headers);
  if (slug) {
    requestHeaders.set("x-tenant-slug", slug);
  }
  if (extraRequestHeaders) {
    for (const [key, value] of Object.entries(extraRequestHeaders)) {
      requestHeaders.set(key, value);
    }
  }
  if (!slug && !extraRequestHeaders) {
    return response;
  }
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function applyAuthAuditHeaders(response: NextResponse, auditValue: string): NextResponse {
  response.headers.set(AUTH_AUDIT_REQUEST_HEADER, auditValue);
  return response;
}

function protectSessionRoute(
  request: NextRequest,
  token: string | undefined,
): NextResponse {
  const validation = validateSessionToken(token);
  const auditLabel = formatAuthAuditLabel(validation);
  const auditValue = authAuditHeaderValue(validation);
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console -- dev-only session audit (see MAP.md)
    console.info(`[auth-audit] ${auditLabel}`);
  }

  if (validation.status === "valid") {
    const response = forwardTenantSlug(request, NextResponse.next(), {
      [AUTH_AUDIT_REQUEST_HEADER]: auditValue,
    });
    return applyAuthAuditHeaders(response, auditValue);
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  const response = NextResponse.redirect(loginUrl);
  if (token?.trim()) {
    clearAllSessionCookiesOnResponse(response);
  }
  return applyAuthAuditHeaders(response, auditValue);
}

const intlMiddleware = createMiddleware(routing);

const LEGACY_LOCALE_PREFIXES = ["/fa", "/en"] as const;

function stripLegacyLocalePrefix(pathname: string): string | null {
  for (const prefix of LEGACY_LOCALE_PREFIXES) {
    if (pathname === prefix) {
      return "/";
    }
    if (pathname.startsWith(`${prefix}/`)) {
      const next = pathname.slice(prefix.length);
      return next === "" ? "/" : next;
    }
  }
  return null;
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/auth/register") ||
    pathname.startsWith("/auth/invite")
  );
}

function isWorkspaceNotFoundPath(pathname: string): boolean {
  return pathname === "/workspace-not-found";
}

function withWorkspaceAssertSkip(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(WORKSPACE_ASSERT_SKIP_HEADER, "1");
  return requestHeaders;
}

function rewriteWorkspaceNotFound(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/workspace-not-found";
  url.search = "";
  return NextResponse.rewrite(url, {
    request: { headers: withWorkspaceAssertSkip(request) },
  });
}

function rewriteOrRateLimitProbe(request: NextRequest): NextResponse {
  const ip = request.ip ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (isProbeRateLimited(ip)) {
    return NextResponse.json(
      { error: { code: "WORKSPACE_HOST_PROBE_RATE_LIMITED", message: "Too many requests" } },
      { status: 429 },
    );
  }
  return rewriteWorkspaceNotFound(request);
}

async function ensureWorkspaceHostKnown(
  request: NextRequest,
): Promise<NextResponse | null> {
  const host = inboundHost(request) ?? request.headers.get("host");
  if (isBareApexHost(host)) {
    return rewriteOrRateLimitProbe(request);
  }

  const evaluated = evaluateWorkspaceHost(host);
  if (!evaluated.ok) {
    return rewriteOrRateLimitProbe(request);
  }

  const known = await isKnownWorkspaceSlug(evaluated.slug);
  if (known) {
    return null;
  }
  return rewriteOrRateLimitProbe(request);
}

import { generateTraceparent } from "./lib/api/tracing-utils";

export default async function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const traceparent = generateTraceparent();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("traceparent", traceparent);

  const pathname = request.nextUrl.pathname;

  if (isWorkspaceNotFoundPath(pathname)) {
    const response = NextResponse.next({
      request: { headers: withWorkspaceAssertSkip(request) },
    });
    response.headers.set("x-request-id", requestId);
    response.headers.set("traceparent", traceparent);
    return response;
  }

  const unknownWorkspace = await ensureWorkspaceHostKnown(request);
  if (unknownWorkspace) {
    unknownWorkspace.headers.set("x-request-id", requestId);
    unknownWorkspace.headers.set("traceparent", traceparent);
    return unknownWorkspace;
  }

  const legacyTarget = stripLegacyLocalePrefix(pathname);
  if (legacyTarget !== null) {
    const url = request.nextUrl.clone();
    url.pathname = legacyTarget;
    const response = NextResponse.redirect(url, 308);
    response.headers.set("x-request-id", requestId);
    response.headers.set("traceparent", traceparent);
    return response;
  }

  const intlResponse = intlMiddleware(request);
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    intlResponse.headers.set("x-request-id", requestId);
    intlResponse.headers.set("traceparent", traceparent);
    return intlResponse;
  }

  if (pathname.startsWith("/static")) {
    const response = NextResponse.next();
    response.headers.set("x-request-id", requestId);
    response.headers.set("traceparent", traceparent);
    return response;
  }

  if (isPublicPath(pathname)) {
    const response = forwardTenantSlug(request, NextResponse.next());
    response.headers.set("x-request-id", requestId);
    response.headers.set("traceparent", traceparent);
    return response;
  }

  const picked = pickSessionTokenFromRequestCookies(request.cookies);
  const sessionResponse = protectSessionRoute(request, picked?.token);
  sessionResponse.headers.set("x-request-id", requestId);
  sessionResponse.headers.set("traceparent", traceparent);
  return sessionResponse;
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
