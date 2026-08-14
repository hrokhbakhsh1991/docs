/**
 * PR23-C2 — operator finance exception read enrichment (behavior-neutral split).
 */
import {
  buildFinanceExceptionId,
  buildFinanceExceptionPaymentsHref,
  buildFinanceExceptionReceiptsHref,
  FINANCE_EXCEPTION_TYPE,
  isPositiveBalanceDueMinor,
  type FinanceExceptionItem,
} from "../domain/finance-exception";
import type { ListFinanceExceptionSourcesResult } from "../ports/finance-repository.port";
import type { RegistrationDisplayPort } from "../ports/registration-display.port";
import {
  attachRegistrationDisplayIdentity,
  tryGetBookingPaymentStatus,
  tryGetRegistrationBalanceDueMinor,
  type FinanceReadEnrichmentDeps,
} from "./finance-read-enrichment";

export type FinanceExceptionOperatorDeps = FinanceReadEnrichmentDeps & {
  readonly registrationDisplay: RegistrationDisplayPort;
};

export function withFinanceExceptionIdentity(
  item: FinanceExceptionItem,
  context: Parameters<typeof attachRegistrationDisplayIdentity>[1]
): FinanceExceptionItem {
  return attachRegistrationDisplayIdentity(item, context);
}

export async function buildOperatorFinanceExceptionItems(
  deps: FinanceExceptionOperatorDeps,
  tenantId: string,
  sources: ListFinanceExceptionSourcesResult
): Promise<readonly FinanceExceptionItem[]> {
  const items: FinanceExceptionItem[] = [];

  for (const row of sources.rejectedReceiptPendingPayments) {
    const bookingPaymentStatus = await tryGetBookingPaymentStatus(
      deps,
      tenantId,
      row.registrationId
    );
    const balanceDueMinor = await tryGetRegistrationBalanceDueMinor(
      deps,
      tenantId,
      row.registrationId
    );
    items.push({
      id: buildFinanceExceptionId(
        FINANCE_EXCEPTION_TYPE.REJECTED_RECEIPT_PENDING_PAYMENT,
        row.paymentId
      ),
      type: FINANCE_EXCEPTION_TYPE.REJECTED_RECEIPT_PENDING_PAYMENT,
      severity: "attention",
      registrationId: row.registrationId,
      identity: {
        memberDisplayName: null,
        tourTitle: null,
        tourId: null,
      },
      payment: {
        id: row.paymentId,
        status: "Pending",
        amount: row.amount,
        currency: row.currency,
        method: row.method,
      },
      reason: row.reviewNote,
      balanceDueMinor,
      bookingPaymentStatus,
      href: {
        payments: buildFinanceExceptionPaymentsHref(row.registrationId),
        receipts: buildFinanceExceptionReceiptsHref(row.registrationId),
      },
      occurredAt: row.occurredAt.toISOString(),
    });
  }

  for (const row of sources.cancelledPayments) {
    const balanceDueMinor = await tryGetRegistrationBalanceDueMinor(
      deps,
      tenantId,
      row.registrationId
    );
    if (!isPositiveBalanceDueMinor(balanceDueMinor)) {
      continue;
    }
    const bookingPaymentStatus = await tryGetBookingPaymentStatus(
      deps,
      tenantId,
      row.registrationId
    );
    items.push({
      id: buildFinanceExceptionId(
        FINANCE_EXCEPTION_TYPE.CANCELLED_PAYMENT_WITH_BALANCE,
        row.paymentId
      ),
      type: FINANCE_EXCEPTION_TYPE.CANCELLED_PAYMENT_WITH_BALANCE,
      severity: "attention",
      registrationId: row.registrationId,
      identity: {
        memberDisplayName: null,
        tourTitle: null,
        tourId: null,
      },
      payment: {
        id: row.paymentId,
        status: "Cancelled",
        amount: row.amount,
        currency: row.currency,
        method: row.method,
      },
      reason: row.reasonCode,
      balanceDueMinor,
      bookingPaymentStatus,
      href: {
        payments: buildFinanceExceptionPaymentsHref(row.registrationId),
      },
      occurredAt: row.occurredAt.toISOString(),
    });
  }

  const registrationIds = [
    ...new Set(items.map((item) => item.registrationId).filter((id) => id.length > 0)),
  ];
  const contexts = await deps.registrationDisplay.getByRegistrationIds(
    tenantId,
    registrationIds
  );
  return items.map((item) =>
    withFinanceExceptionIdentity(item, contexts.get(item.registrationId))
  );
}
