import { resolveStorageDriver } from "../storage/production-storage-driver-assert";
import { PrismaFinanceRepository } from "./infrastructure/prisma-finance.repository";
import { InMemoryFinanceRepository } from "./in-memory-finance.repository";
import type { IBookingPaymentPort } from "./ports/booking-payment.port";
import type { FinanceRepositoryPort } from "./ports/finance-repository.port";

export type { FinanceRepositoryPort } from "./ports/finance-repository.port";

let financeRepositorySingleton: FinanceRepositoryPort | null = null;

/**
 * Composition factory — inject the same {@link IBookingPaymentPort} instance used by FinanceService
 * so Option C approve-atomic and non-TX sync share one adapter.
 * Callers must supply bookingPayments (no default concrete adapter).
 */
export function createFinanceRepository(
  bookingPayments: IBookingPaymentPort
): FinanceRepositoryPort {
  if (bookingPayments === null || bookingPayments === undefined) {
    throw new Error(
      "FINANCE_REPOSITORY_BOOKING_PAYMENTS_REQUIRED: bookingPayments must be provided by the composition root"
    );
  }
  if (financeRepositorySingleton !== null) {
    return financeRepositorySingleton;
  }
  if (resolveStorageDriver() === "memory") {
    financeRepositorySingleton = new InMemoryFinanceRepository(bookingPayments);
  } else {
    financeRepositorySingleton = new PrismaFinanceRepository(bookingPayments);
  }
  return financeRepositorySingleton;
}

export function resetFinanceRepositoryForTests(): void {
  financeRepositorySingleton = null;
}
