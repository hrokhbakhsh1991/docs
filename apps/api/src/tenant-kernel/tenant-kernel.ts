import type { IncomingMessage } from "node:http";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { readRequestAuthHeaders } from "../auth/read-request-headers";
import { parseRequestAuth } from "../auth/request-context";
import { isDevBearerAllowed } from "./auth-env";
import {
  UNAUTHORIZED_DEV_BEARER_DISABLED,
  UNAUTHORIZED_INVALID_BEARER_TOKEN,
} from "./auth-errors";
import { assertRequiredAuthHeaders } from "./assert-required-headers";
import { isDevBearerAuthorization, tryParseDevBearerToken } from "./parse-bearer";
import { tryResolveJwtBearerAsync } from "./parse-jwt-bearer";

/**
 * TenantKernel — single ingress for tenant identity.
 * Order: verified JWT (when configured) → dev bearer (gated) → explicit headers.
 */
export async function resolveTenantContextFromRequest(
  req: IncomingMessage,
): Promise<TenantAuthContext> {
  const authorization = readAuthorizationHeader(req);
  if (authorization.length > 0) {
    const fromJwt = await tryResolveJwtBearerAsync(authorization);
    if (fromJwt !== null) {
      return fromJwt;
    }

    if (isDevBearerAuthorization(authorization)) {
      if (!isDevBearerAllowed()) {
        throw new Error(UNAUTHORIZED_DEV_BEARER_DISABLED);
      }
      return tryParseDevBearerToken(authorization);
    }

    throw new Error(UNAUTHORIZED_INVALID_BEARER_TOKEN);
  }

  const headers = readRequestAuthHeaders(req);
  assertRequiredAuthHeaders(headers);
  return parseRequestAuth(headers);
}

function readAuthorizationHeader(req: IncomingMessage): string {
  const raw = req.headers.authorization;
  if (raw === undefined) return "";
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}
