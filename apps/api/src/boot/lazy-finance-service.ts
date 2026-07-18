import { createFinanceRepository } from "../workspace-finance/finance-repository.factory";
import type { FinanceService } from "../workspace-finance/finance.service";
import { createFinanceService } from "../workspace-finance/finance.service";
import { BookingPaymentAdapter } from "../workspace-finance/infrastructure/booking-payment.adapter";
import {
  resolveBootFinanceWorkspaceType,
  resolveFinanceLedgerPolicy,
  resolveFinanceReceiptDefaults,
} from "../workspace-finance/finance-dependency-registry";

let financeServicePromise: Promise<FinanceService> | null = null;

export function resetLazyFinanceServiceForTests(): void {
  financeServicePromise = null;
}

/**
 * Boot composition root — wires booking + registry-resolved ledger policy + receipt defaults
 * into {@link FinanceService}. Does not import Denali adapter classes.
 * Tests may pass a fully constructed service to bypass the singleton.
 */
export async function resolveLazyFinanceService(
  injected?: FinanceService
): Promise<FinanceService> {
  if (injected !== undefined) {
    return injected;
  }
  if (financeServicePromise === null) {
    const workspaceType = resolveBootFinanceWorkspaceType();
    const bookingPayments = new BookingPaymentAdapter();
    financeServicePromise = Promise.resolve(
      createFinanceService(
        resolveFinanceLedgerPolicy(workspaceType),
        createFinanceRepository(bookingPayments),
        bookingPayments,
        resolveFinanceReceiptDefaults(workspaceType)
      )
    );
  }
  return financeServicePromise;
}
