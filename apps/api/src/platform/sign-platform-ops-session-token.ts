import { SignJWT, importPKCS8, type CryptoKey } from "jose";

import { readJwtVerifyConfig } from "../tenant-kernel/jwt-env.ts";
import { normalizePublicKey } from "../tenant-kernel/jwt-key.util.ts";
import type { PlatformOpsRole } from "./resolve-platform-ops-phone-access.ts";

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

export type PlatformOpsSessionClaims = {
  readonly phone: string;
  readonly role: PlatformOpsRole;
};

export async function signPlatformOpsSessionToken(
  claims: PlatformOpsSessionClaims
): Promise<string> {
  const config = readJwtVerifyConfig();
  const rawPrivatePem = process.env.AUTH_JWT_PRIVATE_KEY?.trim();
  if (config === null || rawPrivatePem === undefined || rawPrivatePem.length === 0) {
    throw new Error("AUTH_JWT_SIGNING_NOT_CONFIGURED");
  }

  const key = await loadPrivateKey(normalizePublicKey(rawPrivatePem));
  return new SignJWT({
    kind: "platform_ops",
    platform_role: claims.role,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(claims.phone)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export function resetPlatformOpsSessionTokenKeyCacheForTests(): void {
  cachedPrivateKey = null;
  cachedPrivateKeyPem = null;
}
