export type { PublicRegistrationApiError } from "@app-tour/catalog-registration-auth";
export {
  PUBLIC_REGISTRATION_DEV_OTP,
  PUBLIC_REGISTRATION_DEV_PHONE,
  PUBLIC_REGISTRATION_MIN_MOBILE_DIGITS,
  PUBLIC_REGISTRATION_RESEND_COOLDOWN_SEC,
  buildPublicRegistrationProfilePayload,
  initialPublicRegistrationOtp,
  initialPublicRegistrationPhone,
  isPublicRegistrationMobileValid,
  normalizePublicRegistrationMobile,
  readPublicRegistrationErrorCode,
} from "@app-tour/catalog-registration-auth";

export type PublicRegistrationStep = "phone" | "otp" | "profile" | "intake" | "done";

export type PublicRegistrationWorkspace = string;
