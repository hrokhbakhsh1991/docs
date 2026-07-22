"use client";

import { User } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveOperatorAvatarPreviewUrl } from "@/features/settings/profile-avatar-client";

type OperatorProfileAvatarSize = "lg" | "sm" | "md";

type OperatorProfileAvatarProps = {
  readonly userId: string;
  readonly displayName?: string | null;
  readonly avatarUrl?: string | null;
  readonly size?: OperatorProfileAvatarSize;
  readonly testId?: string;
  readonly resolvePreview?: boolean;
  readonly fallbackMode?: "initials" | "icon";
  readonly shellChrome?: "account-menu";
};

function initialsFromLabel(label: string): string {
  const compact = label.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "").slice(0, 2);
  return (compact || "OP").toUpperCase();
}

function resolveFallbackInitials(displayName: string | null | undefined, userId: string): string {
  const trimmed = displayName?.trim() ?? "";
  if (trimmed.length > 0) {
    return initialsFromLabel(trimmed);
  }
  return initialsFromLabel(userId);
}

export function OperatorProfileAvatar({
  userId,
  displayName = null,
  avatarUrl: initialAvatarUrl = null,
  size = "lg",
  testId,
  resolvePreview = false,
  fallbackMode = "initials",
  shellChrome,
}: OperatorProfileAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);

  useEffect(() => {
    setAvatarUrl(initialAvatarUrl);
  }, [initialAvatarUrl]);

  useEffect(() => {
    if (!resolvePreview) {
      return;
    }
    let cancelled = false;
    void resolveOperatorAvatarPreviewUrl()
      .then((url) => {
        if (!cancelled) {
          setAvatarUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvatarUrl(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [resolvePreview]);

  const fallbackInitials = resolveFallbackInitials(displayName, userId);
  const showIconFallback = fallbackMode === "icon" || fallbackInitials === "OP";

  const isAccountMenuChrome = shellChrome === "account-menu";

  return (
    <Avatar
      data-operator-profile-avatar={true}
      {...(isAccountMenuChrome ? {} : { "data-operator-profile-avatar-size": size })}
      data-testid={testId}
    >
      {avatarUrl !== null && avatarUrl.length > 0 ? (
        <AvatarImage src={avatarUrl} alt="" data-operator-profile-avatar-image={true} />
      ) : null}
      <AvatarFallback data-operator-profile-avatar-fallback={true}>
        {showIconFallback ? (
          <User data-operator-profile-avatar-icon={true} aria-hidden />
        ) : (
          fallbackInitials
        )}
      </AvatarFallback>
    </Avatar>
  );
}
