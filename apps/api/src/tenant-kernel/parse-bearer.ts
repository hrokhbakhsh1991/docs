import type { ActorRole, MembershipStatus, TenantAuthContext } from "@app-tour/workspace-sdk";
import { parseTenantAuthContext } from "@app-tour/workspace-sdk";

import { assertAuthEnvironmentIntegrity } from "./auth-env";
import { UNAUTHORIZED_INVALID_BEARER_TOKEN } from "./auth-errors";

export const DEV_BEARER_PREFIX = "dev.";

/** Same skew window as RS256 verify in {@link parse-jwt-bearer.ts}. */
export const DEV_BEARER_CLOCK_TOLERANCE_SEC = 5;

type DevBearerPayload = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: ActorRole;
  readonly status: MembershipStatus;
  readonly workspaceId: string;
  readonly exp?: number;
};

function bearerToken(authorization: string): string | null {
  const trimmed = authorization.trim();
  if (!trimmed.startsWith("Bearer ")) {
    return null;
  }
  return trimmed.slice("Bearer ".length).trim();
}

export function isDevBearerAuthorization(authorization: string): boolean {
  const token = bearerToken(authorization);
  return token !== null && token.startsWith(DEV_BEARER_PREFIX);
}

export function readDevBearerTtlSeconds(): number {
  const raw = process.env.AUTH_DEV_BEARER_TTL_SECONDS?.trim();
  if (raw !== undefined && raw.length > 0) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 3600;
}

function assertDevBearerNotExpired(exp: unknown): void {
  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    throw new Error(UNAUTHORIZED_INVALID_BEARER_TOKEN);
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (exp < nowSec - DEV_BEARER_CLOCK_TOLERANCE_SEC) {
    throw new Error(UNAUTHORIZED_INVALID_BEARER_TOKEN);
  }
}

/**
 * Unsigned dev bearer (`dev.<base64url(json)>`) — only when AUTH_ALLOW_DEV_BEARER=true.
 * Payload must include `exp` (Unix seconds); mint via {@link encodeDevBearerToken}.
 */
export function tryParseDevBearerToken(authorization: string): TenantAuthContext {
  assertAuthEnvironmentIntegrity();
  const token = bearerToken(authorization);
  if (token === null || !token.startsWith(DEV_BEARER_PREFIX)) {
    throw new Error(UNAUTHORIZED_INVALID_BEARER_TOKEN);
  }
  try {
    const json = Buffer.from(token.slice(DEV_BEARER_PREFIX.length), "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== "object") {
      throw new Error("payload not object");
    }
    const record = parsed as Record<string, unknown>;
    assertDevBearerNotExpired(record.exp);
    const payload: DevBearerPayload = {
      userId: String(record.userId ?? ""),
      tenantId: String(record.tenantId ?? ""),
      role: record.role as ActorRole,
      status: record.status as MembershipStatus,
      workspaceId: String(record.workspaceId ?? ""),
    };
    return parseTenantAuthContext(payload);
  } catch {
    throw new Error(UNAUTHORIZED_INVALID_BEARER_TOKEN);
  }
}

export function encodeDevBearerToken(context: TenantAuthContext): string {
  const exp = Math.floor(Date.now() / 1000) + readDevBearerTtlSeconds();
  const payload = JSON.stringify({
    userId: context.userId,
    tenantId: context.tenantId,
    role: context.role,
    status: context.status,
    workspaceId: context.workspaceId,
    exp,
  });
  return `Bearer ${DEV_BEARER_PREFIX}${Buffer.from(payload).toString("base64url")}`;
}
