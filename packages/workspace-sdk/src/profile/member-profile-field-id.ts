/** Canonical member profile field ids (portal BFF + capability registry). */
export type MemberProfileFieldId =
  | "displayName"
  | "mobile"
  | "email"
  | "nationalId"
  | "fatherName"
  | "birthDate"
  | "gender"
  | "avatarUrl";

/** Runtime-safe frozen field-id list (sorted) for contract alignment guards. */
export const MEMBER_PROFILE_FIELD_IDS = Object.freeze([
  "avatarUrl",
  "birthDate",
  "displayName",
  "email",
  "fatherName",
  "gender",
  "mobile",
  "nationalId",
] as const satisfies readonly MemberProfileFieldId[]);
