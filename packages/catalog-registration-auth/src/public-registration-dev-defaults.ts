export const PUBLIC_REGISTRATION_DEV_PHONE = "+15550009901";
export const PUBLIC_REGISTRATION_DEV_OTP = "1234";

export function initialPublicRegistrationPhone(): string {
  return process.env.NODE_ENV === "development" ? PUBLIC_REGISTRATION_DEV_PHONE : "";
}

export function initialPublicRegistrationOtp(): string {
  return process.env.NODE_ENV === "development" ? PUBLIC_REGISTRATION_DEV_OTP : "";
}
