"use client";

import { OperatorProfileAvatar } from "@/admin/patterns/operator-profile-avatar";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "./bookings-command-center-types";
import type { BookingListItem } from "./bookings-command-center-types";

type BookingMemberAvatarProps = {
  readonly item: Pick<BookingListItem, "guestLabel" | "memberUserId" | "memberAvatarUrl">;
  readonly size?: "sm" | "md";
};

export function BookingMemberAvatar({ item, size = "sm" }: BookingMemberAvatarProps) {
  const userId = item.memberUserId ?? item.guestLabel;
  return (
    <OperatorProfileAvatar
      userId={userId}
      displayName={item.guestLabel}
      avatarUrl={item.memberAvatarUrl ?? null}
      size={size}
      fallbackMode="icon"
      testId={BOOKINGS_COMMAND_CENTER_TEST_IDS.rowAvatar}
    />
  );
}
