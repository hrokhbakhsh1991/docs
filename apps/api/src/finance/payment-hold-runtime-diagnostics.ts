/**
 * DP1-E — auditable payment-hold / expiry runtime flags (no silent forever-unpaid).
 */
import { isPaymentHoldEnabled } from "./payment-hold.service.ts";

export type PaymentHoldRuntimeDiagnostics = {
  readonly paymentHoldEnabled: boolean;
  readonly paymentHoldExpiryEnabled: boolean;
  readonly expirySchedulerWouldStart: boolean;
  readonly expiryIntervalMs: number;
};

function isPaymentHoldExpiryEnabled(): boolean {
  return process.env.PAYMENT_HOLD_EXPIRY_ENABLED === "true";
}

export function readPaymentHoldRuntimeDiagnostics(): PaymentHoldRuntimeDiagnostics {
  const paymentHoldEnabled = isPaymentHoldEnabled();
  const paymentHoldExpiryEnabled = isPaymentHoldExpiryEnabled();
  const rawInterval = Number(process.env.PAYMENT_HOLD_EXPIRY_INTERVAL_MS);
  const expiryIntervalMs =
    Number.isFinite(rawInterval) && rawInterval > 0 ? Math.trunc(rawInterval) : 60_000;

  return {
    paymentHoldEnabled,
    paymentHoldExpiryEnabled,
    expirySchedulerWouldStart: paymentHoldEnabled && paymentHoldExpiryEnabled,
    expiryIntervalMs,
  };
}
