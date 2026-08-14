/**
 * Optional registration-scoped payment reader for Case SoT (host-only).
 * Does not expand finance-core FinanceRepositoryPort.
 */

import type { FinancePaymentRow } from "@app-tour/finance-core";

import type { FinanceRepositoryPort } from "../ports/finance-repository.port";

/**
 * List payments for one registration under tenant scope.
 * Bounded listPayments + filter until a dedicated repo method exists.
 */
export async function listPaymentsForRegistration(
  repository: FinanceRepositoryPort,
  tenantId: string,
  registrationId: string
): Promise<readonly FinancePaymentRow[]> {
  const all = await repository.listPayments(tenantId, 500);
  return all.filter((row) => row.registrationId === registrationId);
}

export function attachListPaymentsForRegistration(
  repository: FinanceRepositoryPort
): FinanceRepositoryPort & {
  listPaymentsForRegistration: (
    tenantId: string,
    registrationId: string
  ) => Promise<readonly FinancePaymentRow[]>;
} {
  return Object.assign(repository, {
    listPaymentsForRegistration: (tenantId: string, registrationId: string) =>
      listPaymentsForRegistration(repository, tenantId, registrationId),
  });
}
