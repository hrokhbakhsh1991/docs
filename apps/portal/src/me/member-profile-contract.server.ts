import type { MemberProfileFieldId } from "@app-tour/workspace-sdk";

import type { MemberProfileViewPayload, MemberProfileViewProfile } from "./member-profile-types";

/** Frozen portal member profile contract version (BFF boundary). */
export const MEMBER_PROFILE_CONTRACT_VERSION = "v1" as const;

export type MemberProfileContractVersion = typeof MEMBER_PROFILE_CONTRACT_VERSION;

export type MemberProfilePatchBodyV1 = {
  readonly contractVersion?: MemberProfileContractVersion;
  readonly fields: Partial<Record<MemberProfileFieldId, string | null>>;
};

export type MemberProfileApiErrorBody = {
  readonly code: string;
  readonly message: string;
  readonly fieldErrors?: Partial<Record<MemberProfileFieldId, string>>;
};

const MEMBER_PROFILE_ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  AUTH_UNAUTHENTICATED: "Authentication required.",
  AUTH_INVALID_TOKEN: "Session token signature invalid.",
  AUTH_TOKEN_REVOKED: "Session is no longer valid.",
  UNAUTHORIZED_INVALID_BEARER_TOKEN: "Session token is invalid.",
  BACKEND_UNREACHABLE: "Profile service is temporarily unavailable.",
  INVALID_JSON: "Request body is not valid JSON.",
  INVALID_PAYLOAD: "Profile payload is invalid.",
  EMPTY_PATCH: "No profile fields were provided to update.",
  PROFILE_FETCH_FAILED: "Failed to load profile.",
  PROFILE_PATCH_FAILED: "Failed to save profile.",
  PROFILE_FIELD_NOT_SUPPORTED: "One or more profile fields are not supported.",
  PROFILE_FIELD_READ_ONLY: "One or more profile fields cannot be edited.",
  PROFILE_NATIONAL_ID_INVALID: "National ID must be exactly 10 digits.",
  PROFILE_NATIONAL_ID_CHECKSUM: "National ID fails the official checksum.",
  PROFILE_BIRTH_DATE_INVALID: "Birth date is invalid.",
  PROFILE_DISPLAY_NAME_INVALID: "Display name is invalid.",
  PROFILE_FATHER_NAME_INVALID: "Father's name is invalid.",
  PROFILE_ARCHITECTURE_DRIFT_DETECTED:
    "Profile response failed architecture alignment checks. Contact support.",
});

export function resolveMemberProfileErrorMessage(code: string): string {
  return MEMBER_PROFILE_ERROR_MESSAGES[code] ?? "Profile request failed.";
}

export function withMemberProfileContractVersion(
  profile: MemberProfileViewProfile
): MemberProfileViewPayload {
  return {
    ok: true,
    contractVersion: MEMBER_PROFILE_CONTRACT_VERSION,
    profile,
  };
}

export function buildMemberProfileApiError(
  code: string,
  fieldErrors?: Partial<Record<MemberProfileFieldId, string>>
): { readonly ok: false; readonly error: MemberProfileApiErrorBody } {
  const error: MemberProfileApiErrorBody = {
    code,
    message: resolveMemberProfileErrorMessage(code),
  };
  if (fieldErrors !== undefined && Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: { ...error, fieldErrors },
    };
  }
  return { ok: false, error };
}

/** Accept v1 patch bodies with or without explicit contractVersion tag. */
export function normalizeMemberProfilePatchBody(body: unknown): unknown {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }
  const record = body as Record<string, unknown>;
  if (record.contractVersion === undefined) {
    return body;
  }
  if (record.contractVersion !== MEMBER_PROFILE_CONTRACT_VERSION) {
    return body;
  }
  return { fields: record.fields };
}
