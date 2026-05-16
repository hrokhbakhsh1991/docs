import { ConflictException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { RegistrationEntity } from "../registrations/registration.entity";
import { BookingPriceSnapshotEntity } from "./entities/booking-price-snapshot.entity";

export type CreatePricingSnapshotInput = {
  tenantId: string;
  bookingId: string;
  listPriceMinor: string;
  currency: string;
  pricingRuleVersion: string;
  computedTotalMinor: string;
};

/**
 * Persists one **append-only** booking price snapshot (insert-only).
 *
 * **Immutable:** callers must not update returned entities and re-save; corrections require a new insert.
 *
 * TODO: Reconciliation — periodic job comparing snapshot `computed_total_minor` to captured payments / refunds.
 */
export async function createPricingSnapshot(
  manager: EntityManager,
  input: CreatePricingSnapshotInput
): Promise<BookingPriceSnapshotEntity> {
  const tenantId = input.tenantId.trim();
  const bookingId = input.bookingId.trim();
  const booking = await manager.findOne(RegistrationEntity, {
    where: { id: bookingId, tenantId },
    select: { id: true, tenantId: true }
  });
  if (!booking) {
    throw new ConflictException({
      error: {
        code: "BOOKING_PRICE_SNAPSHOT_TENANT_MISMATCH",
        message:
          "Cannot persist a booking price snapshot unless the booking exists under the same tenant_id (append-only row rejected)."
      }
    });
  }

  const row = manager.create(BookingPriceSnapshotEntity, {
    tenantId,
    bookingId,
    listPriceMinor: input.listPriceMinor,
    currency: input.currency.trim().toUpperCase(),
    pricingRuleVersion: input.pricingRuleVersion,
    computedTotalMinor: input.computedTotalMinor
  });
  return manager.save(BookingPriceSnapshotEntity, row);
}
