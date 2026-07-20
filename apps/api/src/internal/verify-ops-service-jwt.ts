import type { IncomingMessage } from "node:http";
import { jwtVerify, type JWTPayload } from "jose";

import { readJwtVerifyConfig } from "../tenant-kernel/jwt-env";
import { loadPublicKey, type JwtPublicKey } from "../tenant-kernel/jwt-key.util";
import { requiresProductionGradeIntegrity } from "../server/runtime-profile";

export const UNAUTHORIZED_OPS_SERVICE_JWT = "UNAUTHORIZED_OPS_SERVICE_JWT";

export const OPS_SCOPE_CACHE_INVALIDATE = "cache:invalidate";
export const OPS_SCOPE_METRICS_READ = "metrics:read";
/** Finance recon/repair — must not equal metrics:read (hostile audit P0). */
export const OPS_SCOPE_FINANCE_RECON = "finance:recon";

/** @deprecated Use {@link UNAUTHORIZED_OPS_SERVICE_JWT} */
export const UNAUTHORIZED_CACHE_INVALIDATE_SERVICE_JWT = UNAUTHORIZED_OPS_SERVICE_JWT;

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

function payloadHasOpsScope(payload: JWTPayload, requiredScope: string): boolean {
  const scope = payload.ops_scope;
  if (scope === requiredScope) {
    return true;
  }
  if (Array.isArray(scope)) {
    return scope.some((entry) => entry === requiredScope);
  }
  return false;
}

function assertServiceSubject(payload: JWTPayload): void {
  const subject = typeof payload.sub === "string" ? payload.sub.trim() : "";
  if (subject.length === 0) {
    throw new Error(UNAUTHORIZED_OPS_SERVICE_JWT);
  }
}

async function verifyWithKey(
  token: string,
  pem: string,
  issuer: string,
  audience: string,
  requiredScope: string,
  slot: "primary" | "previous"
): Promise<void> {
  const key = await loadVerifyKey(pem, slot);
  const verified = await jwtVerify(token, key, {
    algorithms: ["RS256"],
    issuer,
    audience,
    clockTolerance: "5s",
  });
  assertServiceSubject(verified.payload);
  if (!payloadHasOpsScope(verified.payload, requiredScope)) {
    throw new Error(UNAUTHORIZED_OPS_SERVICE_JWT);
  }
}

/**
 * Internal-ops JWT gate — required under production-grade integrity (production + prodlike).
 */
export async function assertOpsServiceJwt(
  authorization: string | undefined,
  requiredScope: string
): Promise<void> {
  if (!requiresProductionGradeIntegrity()) {
    return;
  }

  const config = readJwtVerifyConfig();
  if (config === null) {
    throw new Error(UNAUTHORIZED_OPS_SERVICE_JWT);
  }

  if (authorization === undefined || authorization.trim().length === 0) {
    throw new Error(UNAUTHORIZED_OPS_SERVICE_JWT);
  }

  const token = bearerToken(authorization);
  if (token === null || token.split(".").length !== 3) {
    throw new Error(UNAUTHORIZED_OPS_SERVICE_JWT);
  }

  try {
    await verifyWithKey(
      token,
      config.publicKeyPem,
      config.issuer,
      config.audience,
      requiredScope,
      "primary"
    );
  } catch {
    const previous = config.previousPublicKeyPem;
    if (previous === undefined) {
      throw new Error(UNAUTHORIZED_OPS_SERVICE_JWT);
    }
    try {
      await verifyWithKey(
        token,
        previous,
        config.issuer,
        config.audience,
        requiredScope,
        "previous"
      );
    } catch {
      throw new Error(UNAUTHORIZED_OPS_SERVICE_JWT);
    }
  }
}

export function readAuthorizationHeader(req: IncomingMessage): string | undefined {
  const raw = req.headers.authorization;
  return typeof raw === "string" ? raw : undefined;
}
