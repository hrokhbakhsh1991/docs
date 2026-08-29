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

  const recordById = new Map(records.map((record) => [record.id, record]));
  const memberUserIds = [...new Set(records.map((record) => record.submittedByUserId))];
  const memberships = await getIdentityRepository().findMembershipsByUserIds(
    tenantId,
    memberUserIds
  );
  const avatarUrls = await resolveOperatorAvatarUrlsForMemberships(
    memberUserIds.map((userId) => ({
      tenantId,
      userId,
      storageKey: memberships.get(userId)?.avatar?.storageKey,
    }))
  );
  const avatarByMemberUserId = new Map(
    memberUserIds.map((memberUserId, index) => [memberUserId, avatarUrls[index] ?? null])
  );

  return items.map((item) => {
    const record = recordById.get(item.id);
    if (record === undefined) {
      return item;
    }
    const memberUserId = record.submittedByUserId;
    return {
      ...item,
      memberUserId,
      memberAvatarUrl: avatarByMemberUserId.get(memberUserId) ?? null,
    };
  });
}
