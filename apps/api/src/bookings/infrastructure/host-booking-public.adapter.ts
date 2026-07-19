/**
 * Host adapter — BookingPublicPort → BookingsService composition façades.
 * One guest-duplicate rule; port methods are match-kind projections only.
 */
import type { BookingPublicPort } from "../ports/booking-public.port";
import {
  createPublicGuestBooking,
  findGuestBookingDuplicateMatch,
  sumApprovedPartySizeByTourIds,
} from "../create-bookings-service";

export function createHostBookingPublicAdapter(): BookingPublicPort {
  return {
    async findDuplicateByTourGuest(tenantId, tourId, guestUserId) {
      const duplicate = await findGuestBookingDuplicateMatch(tenantId, tourId, {
        kind: "user",
        value: guestUserId,
      });
      return duplicate === null ? null : { id: duplicate.id };
    },
    async findDuplicateByTourGuestLabel(tenantId, tourId, guestLabel) {
      const duplicate = await findGuestBookingDuplicateMatch(tenantId, tourId, {
        kind: "label",
        value: guestLabel,
      });
      return duplicate === null ? null : { id: duplicate.id };
    },
    async findDuplicateByTourGuestNationalId(tenantId, tourId, nationalId) {
      const duplicate = await findGuestBookingDuplicateMatch(tenantId, tourId, {
        kind: "nationalId",
        value: nationalId,
      });
      return duplicate === null ? null : { id: duplicate.id };
    },
    async findDuplicateByTourEmail(tenantId, tourId, email) {
      const duplicate = await findGuestBookingDuplicateMatch(tenantId, tourId, {
        kind: "email",
        value: email,
      });
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
