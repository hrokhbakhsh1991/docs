export const OPERATOR_PROFILE_GENDERS = ["male", "female", "other"] as const;

export type OperatorProfileGender = (typeof OPERATOR_PROFILE_GENDERS)[number];

export function isOperatorProfileGender(value: string): value is OperatorProfileGender {
  return (OPERATOR_PROFILE_GENDERS as readonly string[]).includes(value);
}
