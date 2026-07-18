import { resolveStorageDriver } from "../storage/production-storage-driver-assert";
import { FinanceRepository } from "./finance.repository";
import { InMemoryFinanceRepository } from "./in-memory-finance.repository";
import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter";
import type { IBookingPaymentPort } from "./ports/booking-payment.port";

export type FinanceRepositoryPort = FinanceRepository | InMemoryFinanceRepository;

let financeRepositorySingleton: FinanceRepositoryPort | null = null;

/**
 * Composition factory — inject the same {@link IBookingPaymentPort} instance used by FinanceService
 * so Option C approve-atomic and non-TX sync share one adapter.
 */
export function createFinanceRepository(
  bookingPayments: IBookingPaymentPort = new BookingPaymentAdapter()
): FinanceRepositoryPort {
  if (financeRepositorySingleton !== null) {
    return financeRepositorySingleton;
  }
  if (resolveStorageDriver() === "memory") {
    financeRepositorySingleton = new InMemoryFinanceRepository(bookingPayments);
  } else {
    financeRepositorySingleton = new FinanceRepository(bookingPayments);
  }
  return financeRepositorySingleton;
}

export function resetFinanceRepositoryForTests(): void {
  financeRepositorySingleton = null;
}
