import { User } from "lucide-react";

import { hasLeaderPickerAvatarUrl } from "../logic/denali-leader-picker-logic";

export type LeaderPickerAvatarProps = {
  readonly displayName: string;
  readonly avatarUrl?: string | null;
  readonly size?: "card" | "chip";
  readonly className?: string;
};

export function LeaderPickerAvatar({
  displayName,
  avatarUrl,
  size = "card",
  className,
}: LeaderPickerAvatarProps) {
  const baseClass =
    size === "chip" ? "denali-leader-picker__chip-avatar" : "denali-leader-picker__avatar";
  const classNames = className ? `${baseClass} ${className}` : baseClass;

  if (hasLeaderPickerAvatarUrl(avatarUrl)) {
    return (
      <span className={classNames} aria-hidden data-denali-leader-avatar="photo">
        <img
          src={avatarUrl}
          alt=""
          className="denali-leader-picker__avatar-image"
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  return (
    <span
      className={classNames}
      aria-hidden
      data-denali-leader-avatar="icon"
      title={displayName}
    >
      <User className="denali-leader-picker__avatar-icon" aria-hidden />
    </span>
  );
}
