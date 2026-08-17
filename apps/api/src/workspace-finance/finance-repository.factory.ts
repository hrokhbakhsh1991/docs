import {
  assertProductionStorageDriver,
  resolveStorageDriver,
} from "../storage/production-storage-driver-assert";
import { DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER } from "../storage/dual-store-role";
import { getBookingsRepository } from "../bookings/create-bookings-repository";
import { PrismaFinanceRepository } from "./infrastructure/prisma-finance.repository";
import { InMemoryFinanceRepository } from "./in-memory-finance.repository";
import type { IBookingPaymentPort } from "./ports/booking-payment.port";
import type { FinanceRepositoryPort } from "./ports/finance-repository.port";

export type { FinanceRepositoryPort } from "./ports/finance-repository.port";

/** PSR-5h — InMemory branch retained as explicit test|dev adapter. */
export const DUAL_STORE_ROLE = DUAL_STORE_ROLE_RETAINED_TEST_DEV_ADAPTER;
let financeRepositorySingleton: FinanceRepositoryPort | null = null;

/**
 * Process-wide finance repository (intentional).
 *
 * Shared across all workspaceType FinanceService instances: persistence is tenant-scoped
 * (Prisma `withTenantRls` / memory filters by tenantId), not workspace-scoped.
 * Callers must supply the same platform {@link IBookingPaymentPort} used by FinanceService.
 * Do not create per-workspace repositories.
 *
 * Production/prodlike refuse memory via {@link assertProductionStorageDriver}
 * (PSR-5a — same posture as bookings/identity/drafts factories).
 */
export function createFinanceRepository(
  bookingPayments: IBookingPaymentPort
): FinanceRepositoryPort {
  if (bookingPayments === null || bookingPayments === undefined) {
    throw new Error(
      "FINANCE_REPOSITORY_BOOKING_PAYMENTS_REQUIRED: bookingPayments must be provided by the composition root"
    );
  }
  assertProductionStorageDriver();
  if (financeRepositorySingleton !== null) {
    return financeRepositorySingleton;
  }
  if (resolveStorageDriver() === "memory") {
    financeRepositorySingleton = new InMemoryFinanceRepository(
      bookingPayments,
      getBookingsRepository()
    );
  } else {
    financeRepositorySingleton = new PrismaFinanceRepository(bookingPayments);
  }
  return financeRepositorySingleton;
}

export function resetFinanceRepositoryForTests(): void {
  financeRepositorySingleton = null;
}
