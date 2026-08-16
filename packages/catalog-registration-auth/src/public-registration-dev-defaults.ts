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
