export const PUBLIC_REGISTRATION_DEV_PHONE = "+15550009901";
export const PUBLIC_REGISTRATION_DEV_OTP = "1234";

/**
 * Guest login phone starts empty. The US smoke number is a named fixture for
 * tests that fill the field — never a visible default (GL-PHONE-01).
 */
export function initialPublicRegistrationPhone(): string {
  return "";
}

export function initialPublicRegistrationOtp(): string {
  return process.env.NODE_ENV === "development" ? PUBLIC_REGISTRATION_DEV_OTP : "";
}

/**
 * Mobile shown on guest `/me` chrome (GL-BRAND-03). The US smoke fixture is
 * never a visible personal label even if a persisted identity still holds it.
 */
export function guestVisibleProfileMobile(mobile: string | null | undefined): string {
  const trimmed = typeof mobile === "string" ? mobile.trim() : "";
  if (trimmed.length === 0 || trimmed === PUBLIC_REGISTRATION_DEV_PHONE) {
    return "";
  }
  return trimmed;
}
