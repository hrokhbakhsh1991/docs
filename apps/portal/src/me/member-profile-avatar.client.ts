import {
  isOperatorAvatarContentType,
  OPERATOR_AVATAR_MAX_BYTES,
} from "@app-tour/workspace-sdk";

export type MemberProfileAvatarValidationCode =
  | "PROFILE_AVATAR_TYPE_INVALID"
  | "PROFILE_AVATAR_TOO_LARGE"
  | "PROFILE_AVATAR_EMPTY";

export function validateMemberProfileAvatarFile(file: File): MemberProfileAvatarValidationCode | null {
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

export async function resolveMemberAvatarPreviewUrl(): Promise<string | null> {
  const response = await fetch("/api/me/avatar/url", { cache: "no-store" });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { url?: string | null };
  const url = payload.url?.trim() ?? "";
  return url.length > 0 ? url : null;
}

export async function uploadMemberAvatar(file: File): Promise<{ readonly avatarUrl?: string | null }> {
  const response = await fetch("/api/me/avatar", {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`PROFILE_AVATAR_UPLOAD_HTTP_${response.status}`);
  }
  return (await response.json()) as { avatarUrl?: string | null };
}

export async function removeMemberAvatar(): Promise<{ readonly avatarUrl?: string | null }> {
  const response = await fetch("/api/me/avatar", { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`PROFILE_AVATAR_DELETE_HTTP_${response.status}`);
  }
  return (await response.json()) as { avatarUrl?: string | null };
}
