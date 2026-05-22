"use client";

import { useState } from "react";

import type { WorkspaceUserDto } from "@/lib/services/users.service";

import {
  resolveAvatarDisplayGender,
  type AvatarDisplayGender
} from "./user-avatar-utils";
import styles from "./users-page.module.css";

export type { AvatarDisplayGender } from "./user-avatar-utils";
export { resolveAvatarDisplayGender } from "./user-avatar-utils";

function GenderFallbackGlyph({ displayGender }: { displayGender: AvatarDisplayGender }) {
  if (displayGender === "male") {
    return (
      <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden focusable="false">
        <circle cx={12} cy={9} r={4} fill="currentColor" opacity={0.9} />
        <path
          fill="currentColor"
          d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6v1H6v-1Z"
          opacity={0.85}
        />
      </svg>
    );
  }
  if (displayGender === "female") {
    return (
      <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden focusable="false">
        <circle cx={12} cy={8.5} r={4} fill="currentColor" opacity={0.9} />
        <path
          fill="currentColor"
          d="M5.5 20c0-2.8 2.4-5 6.5-5s6.5 2.2 6.5 5v1H5.5v-1Z"
          opacity={0.85}
        />
      </svg>
    );
  }
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx={12} cy={12} r={9} fill="none" stroke="currentColor" strokeWidth={1.75} />
      <circle cx={12} cy={10} r={3.25} fill="currentColor" />
      <path fill="currentColor" d="M7 19.5c.8-2.8 2.8-4.5 5-4.5s4.2 1.7 5 4.5" />
    </svg>
  );
}

function avatarVariantClass(displayGender: AvatarDisplayGender): string {
  if (displayGender === "male") {
    return styles.userAvatarMale;
  }
  if (displayGender === "female") {
    return styles.userAvatarFemale;
  }
  return styles.userAvatarNeutral;
}

export type UserAvatarProps = {
  user: Pick<WorkspaceUserDto, "name" | "profileImageUrl" | "gender">;
  className?: string;
};

export function UserAvatar({ user, className }: UserAvatarProps) {
  const displayGender = resolveAvatarDisplayGender(user.gender);
  const imageUrl = user.profileImageUrl?.trim() ?? "";
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = imageUrl.length > 0 && !imageFailed;
  const variant = avatarVariantClass(displayGender);
  const label = user.name?.trim() || "User";

  if (showImage) {
    return (
      <span className={[styles.userAvatar, className].filter(Boolean).join(" ")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className={styles.userAvatarImage}
          onError={() => setImageFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={[styles.userAvatar, variant, className].filter(Boolean).join(" ")}
      role="img"
      aria-label={label}
    >
      <GenderFallbackGlyph displayGender={displayGender} />
    </span>
  );
}
