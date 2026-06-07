import type { IncomingMessage } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { readRequestAuthHeaders } from "../auth/read-request-headers";
import { parseRequestAuth } from "../auth/request-context";
import {
  assertAuthEnvironmentIntegrity,
  isDevBearerAllowed,
  isProductionAuthMode,
} from "./auth-env";
import {
  UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION,
  UNAUTHORIZED_DEV_BEARER_DISABLED,
  UNAUTHORIZED_INVALID_BEARER_TOKEN,
  UNAUTHORIZED_MISSING_WORKSPACE_ID,
} from "./auth-errors";
import { assertWorkspaceMembership } from "../tenant/workspace-membership";
import { assertRequiredAuthHeaders } from "./assert-required-headers";
import { isDevBearerAuthorization, tryParseDevBearerToken } from "./parse-bearer";
import { tryResolveJwtBearerAsync } from "./parse-jwt-bearer";

function assertMemberWorkspaceRequired(role: string, workspaceId: string | undefined): void {
  if (role === "member" && (workspaceId?.trim() ?? "").length === 0) {
    throw new Error(UNAUTHORIZED_MISSING_WORKSPACE_ID);
  }
}

/**
 * TenantKernel — single ingress for tenant identity.
 * Order: verified JWT (when configured) → dev bearer (gated) → explicit headers.
 */
export async function resolveTenantContextFromRequest(
  req: IncomingMessage
): Promise<TenantAuthContext> {
  const authorization = readAuthorizationHeader(req);
  if (isProductionAuthMode() && authorization.length === 0) {
    throw new Error(UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION);
  }
  assertAuthEnvironmentIntegrity();
  if (authorization.length > 0) {
    const fromJwt = await tryResolveJwtBearerAsync(authorization);
    if (fromJwt !== null) {
      assertMemberWorkspaceRequired(fromJwt.role, fromJwt.workspaceId);
      assertWorkspaceMembership(fromJwt.workspaceId);
      return fromJwt;
    }

    if (isDevBearerAuthorization(authorization)) {
      if (!isDevBearerAllowed()) {
        throw new Error(UNAUTHORIZED_DEV_BEARER_DISABLED);
      }
      const fromBearer = tryParseDevBearerToken(authorization);
      assertMemberWorkspaceRequired(fromBearer.role, fromBearer.workspaceId);
      assertWorkspaceMembership(fromBearer.workspaceId);
      return fromBearer;
    }

    throw new Error(UNAUTHORIZED_INVALID_BEARER_TOKEN);
  }

  const headers = readRequestAuthHeaders(req);
  assertRequiredAuthHeaders(headers);
  const auth = parseRequestAuth(headers);
  assertWorkspaceMembership(auth.workspaceId);
  return auth;
}

function readAuthorizationHeader(req: IncomingMessage): string {
  const raw = req.headers.authorization;
  if (raw === undefined) return "";
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}
