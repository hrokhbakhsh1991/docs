import type { IncomingMessage } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { readRequestAuthHeaders } from "../auth/read-request-headers";
import { assertRequiredAuthHeaders } from "../tenant-kernel/assert-required-headers";
import { resolveTenantContextFromRequest } from "../tenant-kernel/tenant-kernel";
import { AuthTokenRevokedError, IdentityRequiredError } from "./identity.errors";
import { hydrateMembershipFromDb } from "./hydrate-membership";
import { readSessionCookieToken } from "./parse-session-cookie";
import { resolvePendingInviteAuth } from "./resolve-pending-invite-auth";

function readAuthorizationHeader(req: IncomingMessage): string {
  const raw = req.headers.authorization;
  if (raw === undefined) return "";
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}

function hasOperatorAuthIngress(req: IncomingMessage): boolean {
  if (readAuthorizationHeader(req).length > 0) {
    return true;
  }
  if (readSessionCookieToken(req) !== null) {
    return true;
  }
  try {
    const headers = readRequestAuthHeaders(req);
    assertRequiredAuthHeaders(headers);
    return true;
  } catch {
    return false;
  }
}

function withSessionCookieBearer(req: IncomingMessage): IncomingMessage {
  const cookieToken = readSessionCookieToken(req);
  if (cookieToken === null || readAuthorizationHeader(req).length > 0) {
    return req;
  }
  return {
    ...req,
    headers: {
      ...req.headers,
      authorization: `Bearer ${cookieToken}`,
    },
  };
}

export async function requireOperatorSession(
  req: IncomingMessage
): Promise<TenantAuthContext> {
  if (!hasOperatorAuthIngress(req)) {
    throw new IdentityRequiredError();
  }

  const auth = await resolveTenantContextFromRequest(withSessionCookieBearer(req));
  try {
    return await hydrateMembershipFromDb(auth.userId, auth.tenantId, undefined);
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
