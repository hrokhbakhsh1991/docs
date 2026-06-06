import type { ActorRole, MembershipStatus, TenantAuthContext } from "@app-tour/workspace-sdk";
import { parseTenantAuthContext } from "@app-tour/workspace-sdk";
import { jwtVerify, type JWTPayload } from "jose";

import { UNAUTHORIZED_INVALID_BEARER_TOKEN } from "./auth-errors";
import { DEV_BEARER_PREFIX } from "./parse-bearer";
import { isJwtVerifyConfigured, readJwtVerifyConfig } from "./jwt-env";
import { loadPublicKey, type JwtPublicKey } from "./jwt-key.util";

let cachedPublicKey: JwtPublicKey | null = null;
let cachedPublicKeyPem: string | null = null;
let cachedPreviousPublicKey: JwtPublicKey | null = null;
let cachedPreviousPublicKeyPem: string | null = null;

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

async function loadVerifyKey(
  pem: string,
  slot: "primary" | "previous" = "primary"
): Promise<JwtPublicKey> {
  if (slot === "previous") {
    if (cachedPreviousPublicKey !== null && cachedPreviousPublicKeyPem === pem) {
      return cachedPreviousPublicKey;
    }
    cachedPreviousPublicKey = await loadPublicKey(pem);
    cachedPreviousPublicKeyPem = pem;
    return cachedPreviousPublicKey;
  }
  if (cachedPublicKey !== null && cachedPublicKeyPem === pem) {
    return cachedPublicKey;
  }
  cachedPublicKey = await loadPublicKey(pem);
  cachedPublicKeyPem = pem;
  return cachedPublicKey;
}

async function verifyWithKey(
  token: string,
  pem: string,
  issuer: string,
  audience: string,
  slot: "primary" | "previous"
): Promise<TenantAuthContext> {
  const key = await loadVerifyKey(pem, slot);
  const verified = await jwtVerify(token, key, {
    algorithms: ["RS256"],
    issuer,
    audience,
    clockTolerance: "5s",
  });
  return mapJwtPayload(verified.payload);
}

function readStringClaim(payload: JWTPayload, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

function readCanonicalClaim(payload: JWTPayload, snakeKey: string, camelKey: string): string {
  const snake = readStringClaim(payload, snakeKey);
  const camel = readStringClaim(payload, camelKey);
  if (snake.length > 0 && camel.length > 0 && snake !== camel) {
    throw new Error(UNAUTHORIZED_INVALID_BEARER_TOKEN);
  }
  return snake.length > 0 ? snake : camel;
}

function mapJwtPayload(payload: JWTPayload): TenantAuthContext {
  const userId = typeof payload.sub === "string" ? payload.sub.trim() : "";
  const tenantId = readCanonicalClaim(payload, "tenant_id", "tenantId");
  const role = (typeof payload.role === "string" ? payload.role.trim() : "") as ActorRole;
  const status = readCanonicalClaim(payload, "membership_status", "status") as MembershipStatus;
  const workspaceId = readCanonicalClaim(payload, "workspace_id", "workspaceId");

  return parseTenantAuthContext({
    userId,
    tenantId,
    role,
    status: status.length > 0 ? status : "ACTIVE",
    ...(workspaceId.length > 0 ? { workspaceId } : {}),
  });
}

/**
 * RS256 JWT verify — runs before dev bearer when {@link isJwtVerifyConfigured}.
 * Returns null when authorization is not a JWT-shaped Bearer token.
 */
export async function tryResolveJwtBearerAsync(
  authorization: string
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
    return await verifyWithKey(
      token,
      config.publicKeyPem,
      config.issuer,
      config.audience,
      "primary"
    );
  } catch {
    const previous = config.previousPublicKeyPem;
    if (previous === undefined) {
      throw new Error(UNAUTHORIZED_INVALID_BEARER_TOKEN);
    }
    try {
      return await verifyWithKey(token, previous, config.issuer, config.audience, "previous");
    } catch {
      throw new Error(UNAUTHORIZED_INVALID_BEARER_TOKEN);
    }
  }
}
