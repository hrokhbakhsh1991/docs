import { createFinanceRepository } from "../workspace-finance/finance-repository.factory";
import type { FinanceService } from "../workspace-finance/finance.service";
import { createFinanceService } from "../workspace-finance/finance.service";
import { BookingPaymentAdapter } from "../workspace-finance/infrastructure/booking-payment.adapter";
import { DenaliFinanceLedgerPolicyAdapter } from "../workspace-finance/infrastructure/denali-finance-ledger-policy.adapter";

let financeServicePromise: Promise<FinanceService> | null = null;

export function resetLazyFinanceServiceForTests(): void {
  financeServicePromise = null;
}

/**
 * Boot composition root — wires booking + Denali ledger policy into {@link FinanceService}.
 * Tests may pass a fully constructed service to bypass the singleton.
 */
export async function resolveLazyFinanceService(
  injected?: FinanceService
): Promise<FinanceService> {
  if (injected !== undefined) {
    return injected;
  }
  if (financeServicePromise === null) {
    financeServicePromise = Promise.resolve(
      createFinanceService(
        new DenaliFinanceLedgerPolicyAdapter(),
        createFinanceRepository(),
        new BookingPaymentAdapter()
      )
    );
  }
  return financeServicePromise;
}
