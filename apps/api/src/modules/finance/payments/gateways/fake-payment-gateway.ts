import type { IPaymentGateway } from "./payment-gateway.interface";
import type { PaymentIntent } from "./payment-intent";
import type { PaymentResult, RefundRequest, RefundResult } from "./payment-result";

/**
 * Non-production gateway: deterministic ids, no HTTP, **no PSP credentials**.
 * Implements **Idempotency-Key** semantics via an in-process map (placeholder for durable store).
 *
 * TODO: Replace map with `IPaymentIdempotencyPlaceholder` backed by DB when wiring real flows.
 * TODO: Stripe / Zibal adapters — see `payment-gateway.interface.ts`.
 */
export class FakePaymentGateway implements IPaymentGateway {
  readonly providerId = "fake";

  private readonly intentResults = new Map<string, PaymentResult>();
  private readonly refundResults = new Map<string, RefundResult>();

  private intentKey(intent: PaymentIntent): string {
    return `${intent.tenantId}::fake::create_payment_intent::${intent.idempotencyKey}`;
  }

  private refundKey(request: RefundRequest): string {
    return `${request.tenantId}::fake::refund::${request.idempotencyKey}`;
  }

  async createPaymentIntent(intent: PaymentIntent): Promise<PaymentResult> {
    const key = this.intentKey(intent);
    const cached = this.intentResults.get(key);
    if (cached) {
      return { ...cached, idempotentReplay: true };
    }
    const suffix = intent.bookingId.replace(/-/g, "").slice(0, 12);
    const created: PaymentResult = {
      status: "requires_payment_method",
      providerPaymentId: `fake_pi_${suffix}`,
      provider: this.providerId,
      clientSecret: `fake_cs_${suffix}`,
      idempotentReplay: false
    };
    this.intentResults.set(key, { ...created, idempotentReplay: false });
    return created;
  }

  async refundPayment(request: RefundRequest): Promise<RefundResult> {
    const key = this.refundKey(request);
    const cached = this.refundResults.get(key);
    if (cached) {
      return { ...cached };
    }
    const out: RefundResult = {
      status: "succeeded",
      providerRefundId: `fake_re_${request.providerPaymentId.replace(/\W/g, "").slice(0, 10)}`,
      amountMinor: request.amountMinor
    };
    this.refundResults.set(key, out);
    return out;
  }
}
