import type { EntityManager } from "typeorm";
import { BookingPriceSnapshotEntity } from "../entities/booking-price-snapshot.entity";

/** Earliest snapshot row for a booking (append-only table; first row is canonical). */
export async function findCanonicalBookingPriceSnapshot(
  manager: EntityManager,
  tenantId: string,
  bookingId: string
): Promise<BookingPriceSnapshotEntity | null> {
  return manager.getRepository(BookingPriceSnapshotEntity).findOne({
    where: {
      tenantId: tenantId.trim(),
      bookingId: bookingId.trim()
    },
    order: { createdAt: "ASC" }
  });
}
