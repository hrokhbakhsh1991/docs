/**
 * Denali Wallet v1 staging deploy — approved pilot identity (non-secret).
 * @see apps/api/test/fixtures/denali-wallet-pilot-tenant.ts
 * @see packages/workspaces/denali/src/smoke/denali-wallet-pilot-tenant.ts
 */
export const DENALI_WALLET_PILOT_TENANT_ID = "00000000-0000-4000-8000-000000000430";

export const DENALI_WALLET_PILOT_SUBDOMAIN = "denali-wallet-pilot";

/** Artifact release SHA is supplied from the checked-out Git HEAD at build time. */
export const DENALI_WALLET_RELEASE_SHA_ENV = "EXPECTED_RELEASE_SHA";

/** Env keys that must never appear in logs or committed deploy output. */
export const WALLET_STAGING_SECRET_ENV_KEYS = Object.freeze([
  "DATABASE_URL",
  "DATABASE_URL_ADMIN",
  "AUTH_JWT_PRIVATE_KEY",
  "AUTH_JWT_PUBLIC_KEY",
  "AUTH_JWT_SECRET",
  "SESSION_SECRET",
  "OTP",
  "COOKIE",
  "TOKEN",
  "PASSWORD",
  "PRIVATE_KEY",
]);

/** Hostname fragments that indicate production — deploy must refuse. */
export const WALLET_STAGING_PRODUCTION_HOST_FRAGMENTS = Object.freeze([
  ".denali.club",
  ".touriran.com",
  ".prod.",
  "production.",
  "app-cloud",
]);

/** Path fragments that indicate non-staging deploy roots. */
export const WALLET_STAGING_PRODUCTION_PATH_FRAGMENTS = Object.freeze([
  "/opt/app-cloud",
  "/etc/app-tour/api.env",
  "/etc/app-cloud",
]);
