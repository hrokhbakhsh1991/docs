/**
 * DP1-E — payment hold expiry scheduler (memory driver).
 */
import { expirePaymentHoldForRegistration } from "./payment-hold-expiry.ts";
import { isPaymentHoldEnabled, PaymentHoldService } from "./payment-hold.service.ts";
import { logger } from "../observability/logger.ts";

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
    try {
      const outcome = await expirePaymentHoldForRegistration({
        tenantId: hold.tenantId,
        registrationId: hold.registrationId,
      });
      if (outcome === "expired") {
        processed += 1;
      } else if (outcome === "deferred") {
        logger.warn({
          event: "payment_hold.expiry_deferred",
          registrationId: hold.registrationId,
          reason: "assigned_passenger_paid_or_partially_paid",
        });
      }
    } catch (error) {
      const failure = error as { code?: unknown; name?: unknown };
      logger.error({
        event: "payment_hold.expiry_failed",
        registrationId: hold.registrationId,
        errorName: typeof failure.name === "string" ? failure.name : "Error",
        errorCode: typeof failure.code === "string" ? failure.code : undefined,
      });
      // Keep the hold open; the next scheduler tick will retry this idempotent workflow.
    }
  }
  return processed;
}

export function startPaymentHoldExpiryScheduler(): void {
  if (!isPaymentHoldEnabled() || !isPaymentHoldExpiryEnabled()) {
    return;
  }
  const intervalMs = Number(process.env.PAYMENT_HOLD_EXPIRY_INTERVAL_MS) || 60_000;
  setInterval(() => {
    void runPaymentHoldExpiryTickForTests(new Date().toISOString()).catch((error: unknown) => {
      const failure = error as { code?: unknown; name?: unknown };
      logger.error({
        event: "payment_hold.expiry_tick_failed",
        errorName: typeof failure.name === "string" ? failure.name : "Error",
        errorCode: typeof failure.code === "string" ? failure.code : undefined,
      });
    });
  }, intervalMs).unref?.();
}
