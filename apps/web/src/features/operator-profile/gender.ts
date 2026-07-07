import {
  isOperatorProfileGender,
  OPERATOR_PROFILE_GENDERS,
  type OperatorProfileGender,
} from "@app-tour/workspace-sdk";

export { isOperatorProfileGender, OPERATOR_PROFILE_GENDERS, type OperatorProfileGender };

export function parseOperatorProfileGender(
  value: string | null | undefined
): OperatorProfileGender | null {
  if (value === null || value === undefined || value.trim().length === 0) {
    return null;
  }
  return isOperatorProfileGender(value) ? value : null;
}

export function formatOperatorProfileGenderLabel(
  gender: OperatorProfileGender | null | undefined,
  translate: (key: "gender.male" | "gender.female" | "gender.other") => string
): string | null {
  if (gender === null || gender === undefined) {
    return null;
  }
  return translate(`gender.${gender}`);
}
