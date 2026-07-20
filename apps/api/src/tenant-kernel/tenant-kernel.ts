import type { IncomingMessage } from "node:http";
import type { TenantAuthContext } from "@app-cloud/workspace-sdk";

import { readRequestAuthHeaders } from "../auth/read-request-headers";
import { parseRequestAuth } from "../auth/request-context";
import {
  assertAuthEnvironmentIntegrity,
  isDevBearerAllowed,
  isDevBearerPermitted,
  isProductionAuthMode,
} from "./auth-env";
import {
  UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION,
  UNAUTHORIZED_DEV_BEARER_DISABLED,
  UNAUTHORIZED_HEADER_AUTH_FORBIDDEN_OUTSIDE_TEST,
  UNAUTHORIZED_INVALID_BEARER_TOKEN,
  UNAUTHORIZED_MISSING_WORKSPACE_ID,
} from "./auth-errors";
import { assertWorkspaceMembership } from "../tenant/workspace-membership";
import { assertRequiredAuthHeaders } from "./assert-required-headers";
import { attachRequestJwtSessionVersion } from "./jwt-session-claim";
import { isDevBearerAuthorization, tryParseDevBearerToken } from "./parse-bearer";
import { tryResolveJwtBearerAsync } from "./parse-jwt-bearer";

function assertMemberWorkspaceRequired(role: string, workspaceId: string | undefined): void {
  if (role === "member" && (workspaceId?.trim() ?? "").length === 0) {
    throw new Error(UNAUTHORIZED_MISSING_WORKSPACE_ID);
  }
}

/**
 * TenantKernel — single ingress for tenant identity.
 * Order: verified JWT (when configured) → dev bearer (gated) → explicit headers (test only).
 */
export async function resolveTenantContextFromRequest(
  req: IncomingMessage
): Promise<TenantAuthContext> {
  const authorization = readAuthorizationHeader(req);
  if (authorization.length === 0) {
    if (isProductionAuthMode()) {
      throw new Error(UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION);
    }
    if (process.env.NODE_ENV !== "test") {
      throw new Error(UNAUTHORIZED_HEADER_AUTH_FORBIDDEN_OUTSIDE_TEST);
    }
  }
  if (
    authorization.length > 0 &&
    isDevBearerAuthorization(authorization) &&
    !isDevBearerPermitted()
  ) {
    throw new Error(UNAUTHORIZED_DEV_BEARER_DISABLED);
  }
  assertAuthEnvironmentIntegrity();
  if (authorization.length > 0) {
    const fromJwt = await tryResolveJwtBearerAsync(authorization);
    if (fromJwt !== null) {
      attachRequestJwtSessionVersion(req, fromJwt.sessionVersion);
      assertMemberWorkspaceRequired(fromJwt.context.role, fromJwt.context.workspaceId);
      assertWorkspaceMembership(fromJwt.context.workspaceId);
      return fromJwt.context;
    }

    if (isDevBearerAuthorization(authorization)) {
      if (!isDevBearerAllowed()) {
        throw new Error(UNAUTHORIZED_DEV_BEARER_DISABLED);
      }
      const fromBearer = tryParseDevBearerToken(authorization);
      attachRequestJwtSessionVersion(req, undefined);
      assertMemberWorkspaceRequired(fromBearer.role, fromBearer.workspaceId);
      assertWorkspaceMembership(fromBearer.workspaceId);
      return fromBearer;
    }

    throw new Error(UNAUTHORIZED_INVALID_BEARER_TOKEN);
  }

  const headers = readRequestAuthHeaders(req);
  assertRequiredAuthHeaders(headers);
  const auth = parseRequestAuth(headers);
  attachRequestJwtSessionVersion(req, undefined);
  assertWorkspaceMembership(auth.workspaceId);
  return auth;
}

function readAuthorizationHeader(req: IncomingMessage): string {
  const raw = req.headers.authorization;
  if (raw === undefined) return "";
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}
