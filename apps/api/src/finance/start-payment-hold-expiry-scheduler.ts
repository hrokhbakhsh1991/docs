/**
 * DP1-E — payment hold expiry scheduler (memory driver).
 */
import { expirePaymentHoldForRegistration } from "./payment-hold-expiry.ts";
import { isPaymentHoldEnabled, PaymentHoldService } from "./payment-hold.service.ts";

let schedulerEnabled = true;

export function resetPaymentHoldExpirySchedulerForTests(): void {
  schedulerEnabled = true;
}

function isPaymentHoldExpiryEnabled(): boolean {
  return process.env.PAYMENT_HOLD_EXPIRY_ENABLED === "true";
}

export async function runPaymentHoldExpiryTickForTests(nowIso: string): Promise<number> {
  if (!schedulerEnabled || !isPaymentHoldEnabled() || !isPaymentHoldExpiryEnabled()) {
    return 0;
  }

  const holdService = new PaymentHoldService();
  const dueHolds = await holdService.scanDueOpenHolds(nowIso);
  let processed = 0;
  for (const hold of dueHolds) {
    await expirePaymentHoldForRegistration({
      tenantId: hold.tenantId,
      registrationId: hold.registrationId,
    });
    processed += 1;
  }
  return processed;
}

export function startPaymentHoldExpiryScheduler(): void {
  if (!isPaymentHoldEnabled() || !isPaymentHoldExpiryEnabled()) {
    return;
  }
  const intervalMs = Number(process.env.PAYMENT_HOLD_EXPIRY_INTERVAL_MS) || 60_000;
  setInterval(() => {
    void runPaymentHoldExpiryTickForTests(new Date().toISOString());
  }, intervalMs).unref?.();
}
