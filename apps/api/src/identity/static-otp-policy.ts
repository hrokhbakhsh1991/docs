/** Static OTP (1234) — explicit opt-in for staging and the approved single-VPS production profile. */
export const STAGING_STATIC_OTP_CODE = "1234";

export function isStagingInfraProfile(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.APP_INFRA_PROFILE?.trim() === "staging";
}

/** Local dev/test path — NODE_ENV development|test unless explicitly disabled. */
export function isLocalDevStaticOtpEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const nodeEnv = env.NODE_ENV?.trim();
  return (
    (nodeEnv === "development" || nodeEnv === "test") &&
    env.AUTH_ALLOW_DEV_STATIC_OTP?.trim() !== "false"
  );
}

/**
 * Staging VPS path — production-like NODE_ENV with explicit flag + staging infra profile.
 * Replaces reliance on NODE_ENV=development for OTP 1234 on staging.
 */
export function isStagingStaticOtpExplicitlyEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.STAGING_ALLOW_STATIC_OTP?.trim() === "true" && isStagingInfraProfile(env)
  );
}

/**
 * Single-VPS production exception: the operator explicitly accepts the fixed
 * OTP contract. Keep this separate from the dev flag so ordinary production
 * deployments remain fail-closed by default.
 */
export function isProductionStaticOtpExplicitlyEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return (
    env.APP_INFRA_PROFILE?.trim() === "production" &&
    env.ALLOW_PRODUCTION_STATIC_OTP?.trim() === "true" &&
    env.AUTH_ALLOW_DEV_STATIC_OTP?.trim() === "true"
  );
}

export function isStaticOtpEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    isLocalDevStaticOtpEnabled(env) ||
    isStagingStaticOtpExplicitlyEnabled(env) ||
    isProductionStaticOtpExplicitlyEnabled(env)
  );
}
