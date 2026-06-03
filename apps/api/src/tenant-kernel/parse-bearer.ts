import type { ActorRole, MembershipStatus, TenantAuthContext } from "@app-tour/workspace-sdk";
import { parseTenantAuthContext } from "@app-tour/workspace-sdk";

import { UNAUTHORIZED_INVALID_BEARER_TOKEN } from "./auth-errors";

export const DEV_BEARER_PREFIX = "dev.";

type DevBearerPayload = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: ActorRole;
  readonly status: MembershipStatus;
  readonly workspaceId: string;
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

/**
 * Unsigned dev bearer (`dev.<base64url(json)>`) — only when AUTH_ALLOW_DEV_BEARER=true.
 */
export function tryParseDevBearerToken(authorization: string): TenantAuthContext {
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
  const payload = JSON.stringify({
    userId: context.userId,
    tenantId: context.tenantId,
    role: context.role,
    status: context.status,
    workspaceId: context.workspaceId,
  });
  return `Bearer ${DEV_BEARER_PREFIX}${Buffer.from(payload).toString("base64url")}`;
}
