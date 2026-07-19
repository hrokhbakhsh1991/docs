import { resolveStorageDriver } from "../storage/production-storage-driver-assert";
import { PrismaFinanceRepository } from "./infrastructure/prisma-finance.repository";
import { InMemoryFinanceRepository } from "./in-memory-finance.repository";
import type { IBookingPaymentPort } from "./ports/booking-payment.port";
import type { FinanceRepositoryPort } from "./ports/finance-repository.port";

export type { FinanceRepositoryPort } from "./ports/finance-repository.port";

let financeRepositorySingleton: FinanceRepositoryPort | null = null;

/**
 * Process-wide finance repository (intentional).
 *
 * Shared across all workspaceType FinanceService instances: persistence is tenant-scoped
 * (Prisma `withTenantRls` / memory filters by tenantId), not workspace-scoped.
 * Callers must supply the same platform {@link IBookingPaymentPort} used by FinanceService.
 * Do not create per-workspace repositories.
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
