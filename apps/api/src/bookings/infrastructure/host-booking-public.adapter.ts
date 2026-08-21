/**
 * Host adapter — BookingPublicPort → BookingsService composition façades.
 * One guest-duplicate rule; port methods are match-kind projections only.
 * kind "user" = active **self** registration (excludes registrantTarget=other).
 */
import type { BookingPublicPort } from "../ports/booking-public.port";
import { getBookingsRepository } from "../create-bookings-repository";
import {
  autoApprovePublicBooking,
  createPublicGuestBooking,
  findGuestBookingDuplicateMatch,
  sumApprovedPartySizeByTourIds,
} from "../create-bookings-service";
import { readRegistrantTargetFromIntake } from "../read-registrant-target";

function toOwnedDetail(row: {
  readonly id: string;
  readonly status: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  readonly paymentStatus: string;
  readonly departureAt: string;
  readonly submittedAt: string;
  readonly partySize: number;
  readonly registrationIntake?: Readonly<Record<string, unknown>>;
}): {
  readonly id: string;
  readonly status: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  readonly registrantTarget: "self" | "other";
  readonly paymentStatus: string;
  readonly departureAt: string;
  readonly submittedAt: string;
  readonly partySize: number;
  readonly registrationIntake?: Readonly<Record<string, unknown>>;
} {
  return {
    id: row.id,
    status: row.status,
    tourId: row.tourId,
    tourTitle: row.tourTitle,
    guestLabel: row.guestLabel,
    registrantTarget: readRegistrantTargetFromIntake(row.registrationIntake),
    paymentStatus: row.paymentStatus,
    departureAt: row.departureAt,
    submittedAt: row.submittedAt,
    partySize: row.partySize,
    ...(row.registrationIntake !== undefined
      ? { registrationIntake: row.registrationIntake }
      : {}),
  };
}

export function createHostBookingPublicAdapter(): BookingPublicPort {
  return {
    async findDuplicateByTourGuest(tenantId, tourId, guestUserId) {
      const duplicate = await findGuestBookingDuplicateMatch(tenantId, tourId, {
        kind: "user",
        value: guestUserId,
      });
      return duplicate === null
        ? null
        : { id: duplicate.id, status: duplicate.status };
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
    async findDuplicateByTourGuestPhone(tenantId, tourId, phone) {
      const duplicate = await findGuestBookingDuplicateMatch(tenantId, tourId, {
        kind: "phone",
        value: phone,
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
    async autoApprovePublicBooking(input) {
      return autoApprovePublicBooking(input);
    },
    async sumApprovedPartySizeByTourIds(tenantId, tourIds) {
      return sumApprovedPartySizeByTourIds(tenantId, tourIds);
    },
    async findOwnedBooking(tenantId, bookingId, guestUserId) {
      const row = await getBookingsRepository().getById(bookingId, tenantId);
      if (row === null || row.submittedByUserId !== guestUserId) {
        return null;
      }
      return toOwnedDetail(row);
    },
    async mergeOwnedRegistrationIntake(input) {
      const repo = getBookingsRepository();
      const existing = await repo.getById(input.bookingId, input.tenantId);
      if (existing === null || existing.submittedByUserId !== input.guestUserId) {
        return null;
      }
      const updated = await repo.mergeRegistrationIntake({
        bookingId: input.bookingId,
        tenantId: input.tenantId,
        patch: input.patch,
      });
      if (updated === null) {
        return null;
      }
      return toOwnedDetail(updated);
    },
    async reclassifyOwnedOtherToSelf(input) {
      return getBookingsRepository().reclassifyOwnedOtherToSelf({
        bookingId: input.bookingId,
        tenantId: input.tenantId,
        submittedByUserId: input.guestUserId,
        guestLabel: input.guestLabel,
        ...(input.guestEmail !== undefined ? { guestEmail: input.guestEmail } : {}),
        ...(input.guestPhone !== undefined ? { guestPhone: input.guestPhone } : {}),
        intakePatch: {
          ...input.registrationIntakePatch,
          registrantTarget: "self",
        },
      });
    },
    async listApprovedTourIdsByGuest(tenantId, guestUserId) {
      return getBookingsRepository().listApprovedTourIdsBySubmittedUser(tenantId, guestUserId);
    },
  };
}
