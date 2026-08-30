"use client";

import { OperatorProfileAvatar } from "@/admin/patterns/operator-profile-avatar";

import {
  bookingsRowAvatarTestId,
  type BookingListItem,
} from "./bookings-command-center-types";

type BookingMemberAvatarProps = {
  readonly item: Pick<BookingListItem, "id" | "guestLabel" | "memberUserId" | "memberAvatarUrl">;
  readonly size?: "sm" | "md";
};

export function BookingMemberAvatar({ item, size = "sm" }: BookingMemberAvatarProps) {
  const memberUserId = item.memberUserId ?? item.id;
  const avatarUrl = item.memberAvatarUrl ?? null;
  return (
    <OperatorProfileAvatar
      key={`${memberUserId}:${avatarUrl ?? "none"}`}
      userId={memberUserId}
      displayName={null}
      avatarUrl={avatarUrl}
      size={size}
      fallbackMode="icon"
      testId={bookingsRowAvatarTestId(item.id)}
    />
  );
}
