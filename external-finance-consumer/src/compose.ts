/**
 * Second-application composition root — only @app-tour/finance-core (+ contracts via transitive).
 */
import {
  createFinanceService,
  type FinanceService,
  type FinanceRepositoryPort,
  type IBookingPaymentPort,
  type FinanceLedgerPolicyPort,
} from "@app-tour/finance-core";

import {
  ExternalAuthz,
  ExternalCapability,
  ExternalClock,
  ExternalDisplay,
  ExternalLogger,
  ExternalMetrics,
  ExternalProof,
  ExternalReceiptDefaults,
  ExternalSchedules,
  ExternalStorage,
  createExternalBookingPort,
  createExternalLedgerPolicy,
  type ExternalLedgerProbe,
} from "./fakes";
import {
  ExternalFinanceRepository,
  resetExternalFinanceRepository,
} from "./in-memory-repository";

export { resetExternalFinanceRepository };

export type ExternalFinanceApp = {
  readonly finance: FinanceService;
  readonly repository: FinanceRepositoryPort;
  readonly booking: IBookingPaymentPort & { readonly paidRegistrations: Set<string> };
  readonly ledger: ExternalLedgerProbe;
};

export function createExternalFinanceApp(): ExternalFinanceApp {
  const booking = createExternalBookingPort();
  const repository = new ExternalFinanceRepository(booking);
  const ledger = createExternalLedgerPolicy();
  const finance = createFinanceService(
    ledger as FinanceLedgerPolicyPort,
    repository,
    booking,
    ExternalReceiptDefaults,
    ExternalDisplay,
    ExternalMetrics,
    ExternalStorage,
    ExternalProof,
    ExternalCapability,
    ExternalAuthz,
    ExternalSchedules,
    ExternalLogger,
    ExternalClock
  );
  return { finance, repository, booking, ledger };
}
