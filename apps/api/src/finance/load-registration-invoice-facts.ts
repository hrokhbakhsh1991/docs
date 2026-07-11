import type { Prisma } from "@prisma/client";

import { MAX_PAYMENTS_PER_REGISTRATION } from "../workspace-finance/finance-list-projection";

type InvoiceFactsTx = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "payment" | "outboxEvent"
>;

export type RegistrationInvoiceFacts = {
  readonly prepaymentMinor: string;
  readonly paidPaymentsMinor: string;
  readonly paymentAmountsMinor: readonly string[];
  readonly currency: string;
};

export async function loadRegistrationInvoiceFacts(
  tx: InvoiceFactsTx,
  tenantId: string,
  registrationId: string
): Promise<RegistrationInvoiceFacts> {
  const [prepaymentSumRows, paidSumRows, payments, latestPrepayment] = await Promise.all([
    tx.$queryRaw<Array<{ sum: string | null }>>`
      SELECT COALESCE(SUM(
        CAST(NULLIF(REGEXP_REPLACE(payload->>'amountMinor', '[^0-9]', '', 'g'), '') AS BIGINT)
      ), 0)::text AS sum
      FROM outbox_events
      WHERE tenant_id = ${tenantId}::uuid
        AND event_type = 'finance.prepayment.recorded'
        AND aggregate_id = ${registrationId}::uuid
    `,
    tx.$queryRaw<Array<{ sum: string | null }>>`
      SELECT COALESCE(SUM(
        CAST(NULLIF(REGEXP_REPLACE(amount, '[^0-9]', '', 'g'), '') AS BIGINT)
      ), 0)::text AS sum
      FROM payments
      WHERE tenant_id = ${tenantId}::uuid
        AND registration_id = ${registrationId}::uuid
        AND status = 'Paid'
    `,
    tx.payment.findMany({
      where: { tenantId, registrationId },
      select: { amount: true, currency: true, status: true },
      orderBy: { createdAt: "desc" },
      take: MAX_PAYMENTS_PER_REGISTRATION,
    }),
    tx.outboxEvent.findFirst({
      where: {
        tenantId,
        eventType: "finance.prepayment.recorded",
        aggregateId: registrationId,
      },
      select: { payload: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  let currency = "IRR";
  const latestPayload =
    latestPrepayment?.payload !== null &&
    latestPrepayment?.payload !== undefined &&
    typeof latestPrepayment.payload === "object"
      ? (latestPrepayment.payload as Record<string, unknown>)
      : null;
  if (latestPayload !== null && typeof latestPayload.currency === "string" && latestPayload.currency.length > 0) {
    currency = latestPayload.currency;
  }

  const paymentAmountsMinor: string[] = [];
  for (const payment of payments) {
    paymentAmountsMinor.push(payment.amount.replace(/\D/g, "") || "0");
    if (payment.currency.length > 0) {
      currency = payment.currency;
    }
  }

  const prepaymentMinor = prepaymentSumRows[0]?.sum ?? "0";
  const paidPaymentsMinor = paidSumRows[0]?.sum ?? "0";

  return {
    prepaymentMinor,
    paidPaymentsMinor,
    paymentAmountsMinor,
    currency,
  };
}
