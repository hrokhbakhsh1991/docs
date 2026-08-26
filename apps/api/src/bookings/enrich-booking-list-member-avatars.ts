import type { BookingListItem } from "@app-tour/booking-http-contracts";

import { getIdentityRepository } from "../identity/create-identity-repository";
import { resolveOperatorAvatarUrlsForMemberships } from "../identity/operator-avatar-storage";
import type { BookingRecord } from "./bookings.types";

export async function enrichBookingListItemsWithMemberAvatars(
  tenantId: string,
  records: readonly BookingRecord[],
  items: readonly BookingListItem[]
): Promise<BookingListItem[]> {
  if (records.length === 0 || items.length === 0) {
    return [...items];
  }

  const userIds = [...new Set(records.map((record) => record.submittedByUserId))];
  const memberships = await getIdentityRepository().findMembershipsByUserIds(tenantId, userIds);
  const avatarUrls = await resolveOperatorAvatarUrlsForMemberships(
    userIds.map((userId) => ({
      tenantId,
      userId,
      storageKey: memberships.get(userId)?.avatar?.storageKey,
    }))
  );
  const avatarByUserId = new Map(userIds.map((userId, index) => [userId, avatarUrls[index] ?? null]));

  return items.map((item, index) => {
    const record = records[index];
    if (record === undefined) {
      return item;
    }
    const memberUserId = record.submittedByUserId;
    return {
      ...item,
      memberUserId,
      memberAvatarUrl: avatarByUserId.get(memberUserId) ?? null,
    };
  });
}
