/**
 * PR23-D1/D2 — outstanding AR load path (behavior-neutral split from FinanceService).
 */
import type { RegistrationInvoiceReadModel } from "../domain/compile-invoice-balances";
import { isPositiveBalanceDueMinor } from "../domain/finance-exception";
import {
  type OutstandingBalanceItem,
} from "../domain/outstanding-balance";
import type {
  FinanceRepositoryPort,
  OutstandingBalanceCandidateRow,
} from "../ports/finance-repository.port";
import type { RegistrationDisplayPort } from "../ports/registration-display.port";
import {
  attachRegistrationDisplayIdentity,
  tryCompileRegistrationInvoiceInternal,
  tryGetBookingPaymentStatus,
  type FinanceReadEnrichmentDeps,
} from "./finance-read-enrichment";

export type FinanceOutstandingOperatorDeps = FinanceReadEnrichmentDeps & {
  readonly repository: Pick<FinanceRepositoryPort, "listOutstandingBalanceCandidates">;
  readonly registrationDisplay: RegistrationDisplayPort;
};

function buildOutstandingBalanceItem(input: {
  readonly candidate: OutstandingBalanceCandidateRow;
  readonly invoice: RegistrationInvoiceReadModel;
  readonly bookingPaymentStatus: "unpaid" | "partial" | "paid" | null;
}): OutstandingBalanceItem {
  return {
    registrationId: input.candidate.registrationId,
    identity: {
      memberDisplayName: null,
      tourTitle: null,
      tourId: null,
    },
    invoice: {
      totalMinor: input.invoice.invoiceTotalMinor,
      paidMinor: input.invoice.paidAmountMinor,
      remainingMinor: input.invoice.balanceDueMinor,
      currency: input.invoice.currency,
    },
    bookingPaymentStatus: input.bookingPaymentStatus,
    occurredAt: input.candidate.occurredAt.toISOString(),
  };
}

/** Shared D1 load path — invoice compile + remaining > 0 + identity. */
export async function loadOutstandingBalanceItems(
  deps: FinanceOutstandingOperatorDeps,
  tenantId: string
): Promise<readonly OutstandingBalanceItem[]> {
  const { candidates } = await deps.repository.listOutstandingBalanceCandidates(tenantId);

  const items: OutstandingBalanceItem[] = [];
  for (const candidate of candidates) {
    const invoice = await tryCompileRegistrationInvoiceInternal(
      deps,
      tenantId,
      candidate.registrationId
    );
    if (invoice === null || !isPositiveBalanceDueMinor(invoice.balanceDueMinor)) {
      continue;
    }
    const bookingPaymentStatus = await tryGetBookingPaymentStatus(
      deps,
      tenantId,
      candidate.registrationId
    );
    items.push(
      buildOutstandingBalanceItem({
        candidate,
        invoice,
        bookingPaymentStatus,
      })
    );
  }

  const registrationIds = [
    ...new Set(items.map((item) => item.registrationId).filter((id) => id.length > 0)),
  ];
  const contexts = await deps.registrationDisplay.getByRegistrationIds(
    tenantId,
    registrationIds
  );
  return items.map((item) =>
    attachRegistrationDisplayIdentity(item, contexts.get(item.registrationId))
  );
}
