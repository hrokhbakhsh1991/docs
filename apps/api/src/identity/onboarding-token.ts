import { SignJWT, importPKCS8, importSPKI, jwtVerify, type CryptoKey } from "jose";

import { readJwtVerifyConfig } from "../tenant-kernel/jwt-env";
import { normalizePublicKey } from "../tenant-kernel/jwt-key.util";

const ONBOARDING_PURPOSE = "public_onboarding";
const ONBOARDING_TTL = "15m";

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

export type OnboardingTokenClaims = {
  readonly mobile: string;
  readonly tenantId: string;
  readonly userId?: string;
};

const ONBOARDING_TOKEN_INVALID = "ONBOARDING_TOKEN_INVALID";

export class OnboardingTokenInvalidError extends Error {
  readonly code = ONBOARDING_TOKEN_INVALID;

  constructor() {
    super(ONBOARDING_TOKEN_INVALID);
    this.name = "OnboardingTokenInvalidError";
  }
}

export async function signOnboardingToken(claims: OnboardingTokenClaims): Promise<string> {
  const config = readJwtVerifyConfig();
  const rawPrivatePem = process.env.AUTH_JWT_PRIVATE_KEY?.trim();
  if (config === null || rawPrivatePem === undefined || rawPrivatePem.length === 0) {
    throw new Error("AUTH_JWT_SIGNING_NOT_CONFIGURED");
  }

  const key = await loadPrivateKey(normalizePublicKey(rawPrivatePem));
  return new SignJWT({
    purpose: ONBOARDING_PURPOSE,
    tenant_id: claims.tenantId,
    mobile: claims.mobile,
    ...(claims.userId !== undefined ? { existing_user_id: claims.userId } : {}),
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(claims.userId ?? claims.mobile)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime(ONBOARDING_TTL)
    .sign(key);
}

export async function verifyOnboardingToken(token: string): Promise<OnboardingTokenClaims> {
  const config = readJwtVerifyConfig();
  const rawPublicPem = process.env.AUTH_JWT_PUBLIC_KEY?.trim();
  if (config === null || rawPublicPem === undefined || rawPublicPem.length === 0) {
    throw new OnboardingTokenInvalidError();
  }

  const key = await importSPKI(normalizePublicKey(rawPublicPem), "RS256");
  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(token, key, {
      issuer: config.issuer,
      audience: config.audience,
    });
    payload = verified.payload as Record<string, unknown>;
  } catch {
    throw new OnboardingTokenInvalidError();
  }

  if (payload.purpose !== ONBOARDING_PURPOSE) {
    throw new OnboardingTokenInvalidError();
  }

  const tenantId = typeof payload.tenant_id === "string" ? payload.tenant_id.trim() : "";
  const mobile = typeof payload.mobile === "string" ? payload.mobile.trim() : "";
  if (tenantId.length === 0 || mobile.length === 0) {
    throw new OnboardingTokenInvalidError();
  }

  const userId =
    typeof payload.existing_user_id === "string" && payload.existing_user_id.trim().length > 0
      ? payload.existing_user_id.trim()
      : undefined;

  return {
    mobile,
    tenantId,
    ...(userId !== undefined ? { userId } : {}),
  };
}

export function resetOnboardingTokenKeyCacheForTests(): void {
  cachedPrivateKey = null;
  cachedPrivateKeyPem = null;
}
