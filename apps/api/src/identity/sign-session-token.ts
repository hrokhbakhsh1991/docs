import { SignJWT, importPKCS8, type CryptoKey } from "jose";

import { readJwtVerifyConfig } from "../tenant-kernel/jwt-env";
import { normalizePublicKey } from "../tenant-kernel/jwt-key.util";

let cachedPrivateKey: CryptoKey | null = null;
let cachedPrivateKeyPem: string | null = null;

async function loadPrivateKey(pem: string): Promise<CryptoKey> {
  if (cachedPrivateKey !== null && cachedPrivateKeyPem === pem) {
    return cachedPrivateKey;
  }
  cachedPrivateKey = await importPKCS8(pem, "RS256");
  cachedPrivateKeyPem = pem;
  return cachedPrivateKey;
}

export type SessionTokenClaims = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: string;
  readonly sessionVersion: number;
  readonly workspaceId?: string;
};

export async function signSessionToken(claims: SessionTokenClaims): Promise<string> {
  const config = readJwtVerifyConfig();
  const rawPrivatePem = process.env.AUTH_JWT_PRIVATE_KEY?.trim();
  if (config === null || rawPrivatePem === undefined || rawPrivatePem.length === 0) {
    throw new Error("AUTH_JWT_SIGNING_NOT_CONFIGURED");
  }

  const key = await loadPrivateKey(normalizePublicKey(rawPrivatePem));
  return new SignJWT({
    tenant_id: claims.tenantId,
    role: claims.role,
    sess_ver: String(claims.sessionVersion),
    ...(claims.workspaceId !== undefined ? { workspace_id: claims.workspaceId } : {}),
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(claims.userId)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export function resetSessionTokenKeyCacheForTests(): void {
  cachedPrivateKey = null;
  cachedPrivateKeyPem = null;
}
