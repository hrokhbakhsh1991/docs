import type { FinanceService } from "../denali-finance/finance.service";
import { createFinanceService } from "../denali-finance/finance.service";

let financeServicePromise: Promise<FinanceService> | null = null;

export function resetLazyFinanceServiceForTests(): void {
  financeServicePromise = null;
}

export async function resolveLazyFinanceService(
  injected?: FinanceService
): Promise<FinanceService> {
  if (injected !== undefined) {
    return injected;
  }
  if (financeServicePromise === null) {
    financeServicePromise = Promise.resolve(createFinanceService());
  }
  return financeServicePromise;
}
