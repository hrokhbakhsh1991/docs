const SYNTHETIC_MOBILE_PATTERN = /^\+1555\d{7}$/;

export type S2E16IdentityInputs = Readonly<{
  tenantAMobile: string;
  tenantBMobile: string;
  otp: string;
}>;

export function resolveS2E16IdentityInputs(
  env: Readonly<Record<string, string | undefined>>
): S2E16IdentityInputs {
  const tenantAMobile = env.DENALI_FIRST_STAGING_FINANCE_MOBILE?.trim() ?? "";
  const tenantBMobile = env.DENALI_SECOND_STAGING_FINANCE_MOBILE?.trim() ?? "";
  const otp = env.OPERATOR_DEV_OTP?.trim() ?? "";

  if (!SYNTHETIC_MOBILE_PATTERN.test(tenantAMobile)) {
    throw new Error("S2E16_TENANT_A_FINANCE_MOBILE_MUST_BE_SYNTHETIC");
  }
  if (!SYNTHETIC_MOBILE_PATTERN.test(tenantBMobile)) {
    throw new Error("S2E16_TENANT_B_FINANCE_MOBILE_MUST_BE_SYNTHETIC");
  }
  if (tenantAMobile === tenantBMobile) {
    throw new Error("S2E16_FINANCE_IDENTITIES_MUST_BE_DISTINCT");
  }
  if (otp.length === 0) {
    throw new Error("S2E16_STATIC_OTP_REQUIRED");
  }
  if (!/^\d{4,8}$/.test(otp)) {
    throw new Error("S2E16_STATIC_OTP_FORMAT_INVALID");
  }

  return { tenantAMobile, tenantBMobile, otp };
}

const AUTH_POST_PATHS = new Set(["/api/auth/request-otp", "/api/auth/login-web-session"]);

export function isS2E16RequestAllowed(method: string, pathname: string): boolean {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === "GET" || normalizedMethod === "HEAD" || normalizedMethod === "OPTIONS") {
    return true;
  }
  return normalizedMethod === "POST" && AUTH_POST_PATHS.has(pathname);
}
