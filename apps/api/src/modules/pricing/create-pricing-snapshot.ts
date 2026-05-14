import type { EntityManager } from "typeorm";
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
  const row = manager.create(BookingPriceSnapshotEntity, {
    tenantId: input.tenantId.trim(),
    bookingId: input.bookingId.trim(),
    listPriceMinor: input.listPriceMinor,
    currency: input.currency.trim().toUpperCase(),
    pricingRuleVersion: input.pricingRuleVersion,
    computedTotalMinor: input.computedTotalMinor
  });
  return manager.save(BookingPriceSnapshotEntity, row);
}
