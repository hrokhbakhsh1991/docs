"use client";

import { User } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveOperatorAvatarPreviewUrl } from "@/features/settings/profile-avatar-client";
import { cn } from "@/lib/utils";

type OperatorProfileAvatarProps = {
  readonly userId: string;
  readonly displayName?: string | null;
  readonly avatarUrl?: string | null;
  readonly className?: string;
  readonly fallbackClassName?: string;
  readonly testId?: string;
  readonly resolvePreview?: boolean;
  readonly fallbackMode?: "initials" | "icon";
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
  className,
  fallbackClassName,
  testId,
  resolvePreview = false,
  fallbackMode = "initials",
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

  return (
    <Avatar className={cn("h-16 w-16", className)} data-testid={testId}>
      {avatarUrl !== null && avatarUrl.length > 0 ? (
        <AvatarImage src={avatarUrl} alt="" className="object-cover" />
      ) : null}
      <AvatarFallback className={cn("bg-muted text-muted-foreground", fallbackClassName)}>
        {showIconFallback ? <User className="h-5 w-5" aria-hidden /> : fallbackInitials}
      </AvatarFallback>
    </Avatar>
  );
}
