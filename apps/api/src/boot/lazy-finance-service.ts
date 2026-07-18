import { createFinanceRepository } from "../workspace-finance/finance-repository.factory";
import type { FinanceService } from "../workspace-finance/finance.service";
import { createFinanceService } from "../workspace-finance/finance.service";
import { BookingPaymentAdapter } from "../workspace-finance/infrastructure/booking-payment.adapter";
import { DenaliFinanceReceiptDefaultsAdapter } from "../workspace-finance/infrastructure/denali-finance-receipt-defaults.adapter";
import { resolveFinanceLedgerPolicy } from "../workspace-finance/resolve-finance-ledger-policy";

let financeServicePromise: Promise<FinanceService> | null = null;

export function resetLazyFinanceServiceForTests(): void {
  financeServicePromise = null;
}

/**
 * Boot composition root — wires booking + ledger policy + receipt defaults into {@link FinanceService}.
 * Tests may pass a fully constructed service to bypass the singleton.
 */
export async function resolveLazyFinanceService(
  injected?: FinanceService
): Promise<FinanceService> {
  if (injected !== undefined) {
    return injected;
  }
  if (financeServicePromise === null) {
    const bookingPayments = new BookingPaymentAdapter();
    financeServicePromise = Promise.resolve(
      createFinanceService(
        resolveFinanceLedgerPolicy(),
        createFinanceRepository(bookingPayments),
        bookingPayments,
        new DenaliFinanceReceiptDefaultsAdapter()
      )
    );
  }
  return financeServicePromise;
}
