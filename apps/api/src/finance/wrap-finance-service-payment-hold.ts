/**
 * DP1-D-05 — wrap FinanceService to satisfy payment holds on capture and auto-approve operator manual payments.
 */
import type { FinanceService } from "@app-tour/finance-core/application";
import type { FinanceActorContext } from "@app-tour/finance-core/ports";

import { satisfyPaymentHoldIfFullyPaid } from "../finance/apply-payment-hold-after-booking-approve.ts";

export function wrapFinanceServiceWithPaymentHold(service: FinanceService): FinanceService {
  const createManualPayment = service.createManualPayment.bind(service);
  const reviewReceipt = service.reviewReceipt.bind(service);
  const getRegistrationInvoice = service.getRegistrationInvoice.bind(service);

  service.createManualPayment = async (auth, body, idempotencyKey) => {
    const payment = await createManualPayment(auth, body, idempotencyKey);
    if (auth.role === "admin" || auth.role === "owner") {
      const paymentStatus = String(payment.status ?? "").toLowerCase();
      if (paymentStatus === "paid") {
        throw new Error("FINANCE_PAYMENT_IDEMPOTENCY_DUPLICATE");
      }
      const receipt = await service.submitReceipt(auth, {
        paymentId: payment.id,
        fileKey: `dp1-operator-manual/${payment.id}.jpg`,
      });
      await reviewReceipt(auth, receipt.id, { decision: "approve" });
      const invoice = await getRegistrationInvoice(auth, body.registrationId);
      await satisfyPaymentHoldIfFullyPaid({
        tenantId: auth.tenantId,
        registrationId: body.registrationId,
        remainingMinor: invoice.balanceDueMinor,
      });
    }
    return payment;
  };

  service.reviewReceipt = async (auth, receiptId, body) => {
    const result = await reviewReceipt(auth, receiptId, body);
    if (body.decision === "approve" && typeof result === "object" && result !== null) {
      const registrationId =
        "registrationId" in result && typeof result.registrationId === "string"
          ? result.registrationId
          : undefined;
      if (registrationId !== undefined) {
        const invoice = await getRegistrationInvoice(auth, registrationId);
        await satisfyPaymentHoldIfFullyPaid({
          tenantId: auth.tenantId,
          registrationId,
          remainingMinor: invoice.balanceDueMinor,
        });
      }
    }
    return result;
  };

  return service;
}
