import type { IncomingMessage } from "node:http";
import type { TenantAuthContext } from "@app-cloud/workspace-sdk";

import { readRequestAuthHeaders } from "../auth/read-request-headers";
import { assertRequiredAuthHeaders } from "../tenant-kernel/assert-required-headers";
import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import { UNAUTHORIZED_HEADER_AUTH_FORBIDDEN_OUTSIDE_TEST } from "../tenant-kernel/auth-errors";
import { readRequestJwtSessionVersion } from "../tenant-kernel/jwt-session-claim";
import { resolveTenantContextFromRequest } from "../tenant-kernel/tenant-kernel";
import { requiresProductionGradeIntegrity } from "../server/runtime-profile";
import { AuthTokenRevokedError, IdentityRequiredError } from "./identity.errors";
import { hydrateMembershipFromDb } from "./hydrate-membership";
import { readSessionCookieToken } from "./parse-session-cookie";
import { resolvePendingInviteAuth } from "./resolve-pending-invite-auth";

function readAuthorizationHeader(req: IncomingMessage): string {
  const raw = req.headers.authorization;
  if (raw === undefined) return "";
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}

function hasPartialHeaderIngress(headers: ReturnType<typeof readRequestAuthHeaders>): boolean {
  return (
    (headers.authenticatedTenantId?.trim().length ?? 0) > 0 ||
    (headers.userId?.trim().length ?? 0) > 0 ||
    (headers.role?.trim().length ?? 0) > 0 ||
    (headers.status?.trim().length ?? 0) > 0 ||
    (headers.workspaceId?.trim().length ?? 0) > 0
  );
}

function assertOperatorAuthIngress(req: IncomingMessage): void {
  if (readAuthorizationHeader(req).length > 0) {
    return;
  }
  if (readSessionCookieToken(req) !== null) {
    return;
  }
  const headers = readRequestAuthHeaders(req);
  if (hasPartialHeaderIngress(headers)) {
    if (process.env.NODE_ENV !== "test") {
      throw new Error(UNAUTHORIZED_HEADER_AUTH_FORBIDDEN_OUTSIDE_TEST);
    }
    assertRequiredAuthHeaders(headers);
    return;
  }
  throw new IdentityRequiredError();
}

function withSessionCookieBearer(req: IncomingMessage): IncomingMessage {
  const cookieToken = readSessionCookieToken(req);
  if (cookieToken === null || readAuthorizationHeader(req).length > 0) {
    return req;
  }
  req.headers.authorization = `Bearer ${cookieToken}`;
  return req;
}

export async function requireOperatorSession(
  req: IncomingMessage
): Promise<TenantAuthContext> {
  assertOperatorAuthIngress(req);

  // Header-only ingress (NODE_ENV=test only) matches POST /tours: trust parsed
  // headers without a pre-ALS membership lookup that can race under concurrent load.
  const headerOnlyIngress =
    readAuthorizationHeader(req).length === 0 && readSessionCookieToken(req) === null;

  const authReq = withSessionCookieBearer(req);
  const auth = await resolveTenantContextFromRequest(authReq);
  if (headerOnlyIngress) {
    return auth;
  }

  const sessionVersionClaim = readRequestJwtSessionVersion(authReq);
  if (requiresProductionGradeIntegrity() && sessionVersionClaim === undefined) {
    throw new AuthTokenRevokedError();
  }

  try {
    return await hydrateMembershipFromDb(auth.userId, auth.tenantId, sessionVersionClaim);
  } catch (error) {
    if (error instanceof AuthTokenRevokedError) {
      const pendingInviteAuth = await resolvePendingInviteAuth(auth.userId, auth.tenantId);
      if (pendingInviteAuth !== null) {
        return pendingInviteAuth;
      }
      if (process.env.NODE_ENV === "test") {
        return auth;
      }
    }
    throw error;
  }
}
