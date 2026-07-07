import {
  isOperatorAvatarContentType,
  OPERATOR_AVATAR_MAX_BYTES,
} from "@app-tour/workspace-sdk";

export type OperatorAvatarFileValidationCode =
  | "PROFILE_AVATAR_TYPE_INVALID"
  | "PROFILE_AVATAR_TOO_LARGE"
  | "PROFILE_AVATAR_EMPTY";

export function validateOperatorAvatarFile(file: File): OperatorAvatarFileValidationCode | null {
  if (file.size === 0) {
    return "PROFILE_AVATAR_EMPTY";
  }
  if (file.size > OPERATOR_AVATAR_MAX_BYTES) {
    return "PROFILE_AVATAR_TOO_LARGE";
  }
  if (!isOperatorAvatarContentType(file.type)) {
    return "PROFILE_AVATAR_TYPE_INVALID";
  }
  return null;
}
