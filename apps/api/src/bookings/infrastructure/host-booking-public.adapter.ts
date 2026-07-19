/**
 * Host adapter — BookingPublicPort → BookingsService composition façades.
 * Behavior identical to the former inline object in configure-workspace-denali-product-http-host.
 */
import type { BookingPublicPort } from "../ports/booking-public.port";
import {
  createPublicGuestBooking,
  findGuestBookingDuplicate,
  findGuestBookingDuplicateByGuestLabel,
  findGuestBookingDuplicateByTourNationalId,
  findGuestBookingDuplicateByUser,
  sumApprovedPartySizeByTourIds,
} from "../create-bookings-service";

export function createHostBookingPublicAdapter(): BookingPublicPort {
  return {
    async findDuplicateByTourGuest(tenantId, tourId, guestUserId) {
      const duplicate = await findGuestBookingDuplicateByUser(tenantId, tourId, guestUserId);
      return duplicate === null ? null : { id: duplicate.id };
    },
    async findDuplicateByTourGuestLabel(tenantId, tourId, guestLabel) {
      const duplicate = await findGuestBookingDuplicateByGuestLabel(tenantId, tourId, guestLabel);
      return duplicate === null ? null : { id: duplicate.id };
    },
    async findDuplicateByTourGuestNationalId(tenantId, tourId, nationalId) {
      const duplicate = await findGuestBookingDuplicateByTourNationalId(
        tenantId,
        tourId,
        nationalId
      );
      return duplicate === null ? null : { id: duplicate.id };
    },
    async findDuplicateByTourEmail(tenantId, tourId, email) {
      const duplicate = await findGuestBookingDuplicate(tenantId, tourId, email);
      return duplicate === null ? null : { id: duplicate.id };
    },
    async createPendingBooking(input) {
      const created = await createPublicGuestBooking(
        {
          tenantId: input.tenantId,
          userId: input.guestUserId,
          role: "none",
          status: "ACTIVE",
        },
        {
          tourId: input.tourId,
          tourTitle: input.tourTitle,
          guestLabel: input.guestLabel,
          guestEmail: input.guestEmail,
          guestPhone: input.guestPhone,
          partySize: input.partySize,
          departureAt: input.departureAt,
          ...(input.registrationIntake !== undefined
            ? { registrationIntake: input.registrationIntake }
            : {}),
        }
      );
      return { id: created.id, status: created.status };
    },
    async sumApprovedPartySizeByTourIds(tenantId, tourIds) {
      return sumApprovedPartySizeByTourIds(tenantId, tourIds);
    },
  };
}
