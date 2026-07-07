import type { FinanceService } from "../workspace-finance/finance.service";
import { createFinanceService } from "../workspace-finance/finance.service";

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
