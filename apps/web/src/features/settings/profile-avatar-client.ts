import type { OperatorProfile } from "@/features/settings/profile-settings-logic";

export async function resolveOperatorAvatarPreviewUrl(): Promise<string | null> {
  const response = await fetch("/api/identity/me/avatar/url", { cache: "no-store" });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`PROFILE_AVATAR_URL_HTTP_${response.status}`);
  }
  const payload = (await response.json()) as { url?: string };
  return payload.url?.trim() ?? null;
}

export async function uploadOperatorAvatar(file: File): Promise<OperatorProfile> {
  const response = await fetch("/api/identity/me/avatar", {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`PROFILE_AVATAR_UPLOAD_HTTP_${response.status}`);
  }
  return (await response.json()) as OperatorProfile;
}

export async function removeOperatorAvatar(): Promise<OperatorProfile> {
  const response = await fetch("/api/identity/me/avatar", { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`PROFILE_AVATAR_DELETE_HTTP_${response.status}`);
  }
  return (await response.json()) as OperatorProfile;
}
