import type { ActorRole, MembershipStatus, TenantAuthContext } from "@app-tour/workspace-sdk";
import { parseTenantAuthContext } from "@app-tour/workspace-sdk";
import { jwtVerify, type JWTPayload } from "jose";

import { UNAUTHORIZED_INVALID_BEARER_TOKEN } from "./auth-errors";
import { DEV_BEARER_PREFIX } from "./parse-bearer";
import { isJwtVerifyConfigured, readJwtVerifyConfig } from "./jwt-env";
import { loadPublicKey, type JwtPublicKey } from "./jwt-key.util";

let cachedPublicKey: JwtPublicKey | null = null;
let cachedPublicKeyPem: string | null = null;

function bearerToken(authorization: string): string | null {
  const trimmed = authorization.trim();
  if (!trimmed.startsWith("Bearer ")) {
    return null;
  }
  return trimmed.slice("Bearer ".length).trim();
}

function isJwtShapedBearer(authorization: string): boolean {
  const token = bearerToken(authorization);
  if (token === null || token.startsWith(DEV_BEARER_PREFIX)) {
    return false;
  }
  return token.split(".").length === 3;
}

async function loadVerifyKey(pem: string): Promise<JwtPublicKey> {
  if (cachedPublicKey !== null && cachedPublicKeyPem === pem) {
    return cachedPublicKey;
  }
  cachedPublicKey = await loadPublicKey(pem);
  cachedPublicKeyPem = pem;
  return cachedPublicKey;
}

function mapJwtPayload(payload: JWTPayload): TenantAuthContext {
  const userId = typeof payload.sub === "string" ? payload.sub.trim() : "";
  const tenantId =
    typeof payload.tenant_id === "string"
      ? payload.tenant_id.trim()
      : typeof payload.tenantId === "string"
        ? payload.tenantId.trim()
        : "";
  const role = (typeof payload.role === "string" ? payload.role.trim() : "") as ActorRole;
  const statusRaw =
    typeof payload.membership_status === "string"
      ? payload.membership_status.trim()
      : typeof payload.status === "string"
        ? payload.status.trim()
        : "ACTIVE";
  const status = statusRaw as MembershipStatus;
  const workspaceId =
    typeof payload.workspace_id === "string"
      ? payload.workspace_id.trim()
      : typeof payload.workspaceId === "string"
        ? payload.workspaceId.trim()
        : "";

  return parseTenantAuthContext({
    userId,
    tenantId,
    role,
    status,
    workspaceId,
  });
}

/**
 * RS256 JWT verify — runs before dev bearer when {@link isJwtVerifyConfigured}.
 * Returns null when authorization is not a JWT-shaped Bearer token.
 */
export async function tryResolveJwtBearerAsync(
  authorization: string,
): Promise<TenantAuthContext | null> {
  if (!isJwtShapedBearer(authorization)) {
    return null;
  }
  if (!isJwtVerifyConfigured()) {
    return null;
  }

  const config = readJwtVerifyConfig()!;
  const token = bearerToken(authorization)!;

  try {
    const key = await loadVerifyKey(config.publicKeyPem);
    const verified = await jwtVerify(token, key, {
      algorithms: ["RS256"],
      issuer: config.issuer,
      audience: config.audience,
      clockTolerance: "5s",
    });
    return mapJwtPayload(verified.payload);
  } catch {
    throw new Error(UNAUTHORIZED_INVALID_BEARER_TOKEN);
  }
}
