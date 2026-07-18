export type PublicRegistrationApiError = {
  readonly ok?: boolean;
  readonly challenge_id?: string;
  readonly requires_registration?: boolean;
  readonly onboarding_token?: string;
  readonly error?: { readonly code?: string };
};

export {
  PUBLIC_REGISTRATION_DEV_OTP,
  PUBLIC_REGISTRATION_DEV_PHONE,
  initialPublicRegistrationOtp,
  initialPublicRegistrationPhone,
} from "./public-registration-dev-defaults";

export const PUBLIC_REGISTRATION_RESEND_COOLDOWN_SEC = 45;
export const PUBLIC_REGISTRATION_MIN_MOBILE_DIGITS = 8;

export function readPublicRegistrationErrorCode(data: PublicRegistrationApiError): string {
  return typeof data.error?.code === "string" ? data.error.code : "network";
}

export {
  type CatalogRegistrationFlowState,
  type CatalogRegistrationSavedSelfIntakeDefaults,
  type CatalogRegistrationTransportIntakeState,
  CatalogRegistrationFlowStateError,
  CATALOG_REGISTRATION_FLOW_STATE_KEYS,
  assertCatalogRegistrationFlowState,
  createCatalogRegistrationFlowInitialData,
  createCatalogRegistrationFlowRuntimeState,
  readCatalogRegistrationFlowState,
} from "./registration-flow-state";

export { normalizePublicRegistrationMobile } from "./normalize-public-registration-mobile";

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

export function resolveIntakeDefaults(input: {
  readonly profileDisplayName?: string;
  readonly sessionDisplayName?: string;
  readonly sessionNationalId?: string | null;
  readonly sessionFatherName?: string | null;
  readonly sessionBirthDate?: string | null;
  readonly registrantTarget?: "self" | "other";
}): {
  readonly name: string;
  readonly nationalId: string;
  readonly fatherName: string;
  readonly birthDate: string;
} {
  if (input.registrantTarget === "other") {
    return { name: "", nationalId: "", fatherName: "", birthDate: "" };
  }

  const profileName = input.profileDisplayName?.trim() ?? "";
  const sessionName = input.sessionDisplayName?.trim() ?? "";

  return {
    name: profileName.length > 0 ? profileName : sessionName,
    nationalId: input.sessionNationalId?.trim() ?? "",
    fatherName: input.sessionFatherName?.trim() ?? "",
    birthDate: input.sessionBirthDate?.trim() ?? "",
  };
}
