"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import {
  removeMemberAvatar,
  uploadMemberAvatar,
  validateMemberProfileAvatarFile,
} from "@/me/member-profile-avatar.client";

type MemberProfileAvatarProps = {
  readonly userId: string;
  readonly displayName: string | null | undefined;
  readonly initialAvatarUrl: string | null | undefined;
  readonly onAvatarChange: (avatarUrl: string | null) => void;
};

function initialsFromLabel(label: string): string {
  const compact = label.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "").slice(0, 2);
  return (compact || "؟").toUpperCase();
}

export function MemberProfileAvatar({
  userId,
  displayName,
  initialAvatarUrl,
  onAvatarChange,
}: MemberProfileAvatarProps) {
  const t = useTranslations("portalMember.profile");
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = displayName?.trim() || userId;
  const initials = initialsFromLabel(label);

  async function handleFileSelected(file: File): Promise<void> {
    setError(null);
    const validation = validateMemberProfileAvatarFile(file);
    if (validation !== null) {
      setError(t(`avatarErrors.${validation}`));
      return;
    }
    setUploading(true);
    try {
      const result = await uploadMemberAvatar(file);
      const nextUrl = result.avatarUrl ?? null;
      setAvatarUrl(nextUrl);
      onAvatarChange(nextUrl);
    } catch {
      setError(t("avatarErrors.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(): Promise<void> {
    setError(null);
    setUploading(true);
    try {
      await removeMemberAvatar();
      setAvatarUrl(null);
      onAvatarChange(null);
    } catch {
      setError(t("avatarErrors.removeFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div data-member-profile-avatar>
      <div data-member-profile-avatar-preview aria-hidden={avatarUrl === null}>
        {avatarUrl !== null && avatarUrl.length > 0 ? (
          <img src={avatarUrl} alt="" data-member-profile-avatar-image />
        ) : (
          <span data-member-profile-avatar-initials>{initials}</span>
        )}
      </div>
      <div data-member-profile-avatar-actions>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          data-member-profile-avatar-upload
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) {
              void handleFileSelected(file);
            }
            event.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? t("avatarUploading") : t("avatarUpload")}
        </button>
        {avatarUrl !== null ? (
          <button
            type="button"
            disabled={uploading}
            data-member-profile-avatar-remove
            onClick={() => void handleRemove()}
          >
            {t("avatarRemove")}
          </button>
        ) : null}
      </div>
      <p data-member-profile-avatar-hint>{t("avatarHint")}</p>
      {error !== null ? (
        <p role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
