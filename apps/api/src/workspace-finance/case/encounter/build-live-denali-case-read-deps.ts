/**
 * Build HostDenaliCaseReadDeps for Case Encounter HTTP (PR12-A).
 */

import { createBookingPaymentPort } from "../../../bookings/create-booking-payment-port";
import { getBookingsRepository } from "../../../bookings/create-bookings-repository";
import { createFinanceObligationPort } from "../../finance-obligation.factory";
import { createFinanceRepository } from "../../finance-repository.factory";
import { resolveFinanceWorkspaceTypeForTenant } from "../../resolve-finance-workspace-type-for-tenant";
import { financeWorkspaceHasCapability } from "../../workspace-finance-capabilities.generated";
import type { HostDenaliCaseReadDeps } from "../host-denali-case-read-source";
import { listPaymentsForRegistration } from "../list-payments-for-registration";

export class FinanceCaseMeaningWorkspaceUnsupportedError extends Error {
  constructor(readonly workspaceType: string) {
    super(`Finance Case Meaning is not supported for workspace '${workspaceType}'`);
    this.name = "FinanceCaseMeaningWorkspaceUnsupportedError";
  }
}

export function assertFinanceCaseMeaningWorkspace(workspaceType: string): void {
  if (!financeWorkspaceHasCapability(workspaceType, "caseMeaning")) {
    throw new FinanceCaseMeaningWorkspaceUnsupportedError(workspaceType);
  }
}

export async function buildLiveDenaliCaseReadDepsForTenant(
  tenantId: string
): Promise<Omit<HostDenaliCaseReadDeps, "tenantId">> {
  const workspaceType = await resolveFinanceWorkspaceTypeForTenant(tenantId);
  assertFinanceCaseMeaningWorkspace(workspaceType);
  const repository = createFinanceRepository(createBookingPaymentPort());
  const obligation = await createFinanceObligationPort(workspaceType);
  return {
    bookings: getBookingsRepository(),
    obligation,
    finance: {
      findLatestReceiptForRegistration: (tid, registrationId) =>
        repository.findLatestReceiptForRegistration(tid, registrationId),
      getRegistrationInvoiceFacts: (tid, registrationId) =>
        repository.getRegistrationInvoiceFacts(tid, registrationId),
      findPaymentStatusesByRegistration: (tid, registrationId) =>
        repository.findPaymentStatusesByRegistration(tid, registrationId),
      findFirstPendingManualPayment: (tid, registrationId) =>
        repository.findFirstPendingManualPayment(tid, registrationId),
      listPendingReceipts: (tid, query) => repository.listPendingReceipts(tid, query),
      listLedgerEvents: (tid, limit) => repository.listLedgerEvents(tid, limit),
      listPaymentsForRegistration: (tid, registrationId) =>
        listPaymentsForRegistration(repository, tid, registrationId),
    },
  };
}
