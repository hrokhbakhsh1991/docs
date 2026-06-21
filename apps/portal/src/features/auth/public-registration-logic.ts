export type PublicRegistrationStep = "phone" | "otp" | "profile" | "intake" | "done";

export type PublicRegistrationWorkspace = "denali" | "urban";

export type PublicRegistrationApiError = {
  ok?: boolean;
  challenge_id?: string;
  requires_registration?: boolean;
  onboarding_token?: string;
  error?: { code?: string };
};

export const PUBLIC_REGISTRATION_RESEND_COOLDOWN_SEC = 45;
export const PUBLIC_REGISTRATION_DEV_PHONE = "+15550009901";
export const PUBLIC_REGISTRATION_DEV_OTP = "1234";
export const PUBLIC_REGISTRATION_MIN_MOBILE_DIGITS = 8;

export function readPublicRegistrationErrorCode(data: PublicRegistrationApiError): string {
  return typeof data.error?.code === "string" ? data.error.code : "network";
}

export function initialPublicRegistrationPhone(): string {
  return process.env.NODE_ENV === "development" ? PUBLIC_REGISTRATION_DEV_PHONE : "";
}

export function initialPublicRegistrationOtp(): string {
  return process.env.NODE_ENV === "development" ? PUBLIC_REGISTRATION_DEV_OTP : "";
}

export function isPublicRegistrationMobileValid(mobile: string): boolean {
  const digits = mobile.replace(/\D/g, "");
  return digits.length >= PUBLIC_REGISTRATION_MIN_MOBILE_DIGITS;
}

export function buildPublicRegistrationProfilePayload(input: {
  readonly onboardingToken: string;
  readonly displayName: string;
  readonly profileEmail: string;
}): Record<string, string> {
  const name = input.displayName.trim();
  const email = input.profileEmail.trim();
  return {
    onboarding_token: input.onboardingToken,
    display_name: name,
    ...(email.length > 0 ? { email } : {}),
  };
}
