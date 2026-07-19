/**
 * Single-credit invariant helpers — Path A (payment capture) XOR Path B (TourCreated paid).
 * Does not change Phase 3B capture domainEventId formulas.
 */
import type { Prisma } from "@prisma/client";

import { paymentLedgerCaptureDomainEventId } from "./paid-without-ledger-detection";

export function tourCreatedLedgerDomainEventPrefix(registrationId: string): string {
  return `finance.ledger:${registrationId.trim()}:tour-created:`;
}

export function isTourCreatedLedgerDomainEventId(
  domainEventId: string,
  registrationId: string
): boolean {
  return domainEventId.startsWith(tourCreatedLedgerDomainEventPrefix(registrationId));
}

/** Stable advisory-lock key material (tenant + registration). */
export function registrationWalletCreditLockKey(
  tenantId: string,
  registrationId: string
): string {
  return `${tenantId.trim()}:${registrationId.trim()}`;
}

export async function advisoryLockRegistrationWalletCredit(
  tx: Prisma.TransactionClient,
  tenantId: string,
  registrationId: string
): Promise<void> {
  const key = registrationWalletCreditLockKey(tenantId, registrationId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

/**
 * True when Path A capture or Path B TourCreated ledger already exists for the registration.
 */
export async function registrationHasBookingWalletCredit(
  tx: Prisma.TransactionClient,
  tenantId: string,
  registrationId: string
): Promise<boolean> {
  const prefix = tourCreatedLedgerDomainEventPrefix(registrationId);
  const tourHit = await tx.outboxEvent.findFirst({
    where: {
      tenantId,
      eventType: "finance.ledger.double_entry_applied",
      domainEventId: { startsWith: prefix },
    },
    select: { id: true },
  });
  if (tourHit !== null) {
    return true;
  }

  const payments = await tx.payment.findMany({
    where: { tenantId, registrationId },
    select: { id: true },
  });
  if (payments.length === 0) {
    return false;
  }
  const captureIds = payments.map((p) => paymentLedgerCaptureDomainEventId(p.id));
  const captureHit = await tx.outboxEvent.findFirst({
    where: {
      tenantId,
      eventType: "finance.ledger.double_entry_applied",
      domainEventId: { in: captureIds },
    },
    select: { id: true },
  });
  return captureHit !== null;
}
