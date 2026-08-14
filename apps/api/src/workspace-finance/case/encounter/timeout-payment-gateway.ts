/**
 * PaymentGatewayPort timeout wrapper (PR12-C).
 * Slow gateway → { ok:false, reason:"timeout" } → unknown/degraded facts upstream.
 * Never invents settlement / paid values.
 */

import type {
  PaymentGatewayPort,
  GatewayReadResult,
} from "../payment-capability/gateway/payment-gateway.port";
import { withEncounterTimeout, EncounterExecutionTimeoutError } from "./encounter-execution-timeout";

export type TimeoutPaymentGatewayOptions = {
  readonly timeoutMs: number;
  readonly now?: () => number;
  /** Optional attribution callback (telemetry). Fail-open at call site. */
  readonly onLatency?: (input: {
    readonly latencyMs: number;
    readonly timedOut: boolean;
  }) => void;
};

/**
 * Wrap a gateway so each readPaymentBySubject is budgeted.
 */
export function withEncounterGatewayTimeout(
  gateway: PaymentGatewayPort,
  options: TimeoutPaymentGatewayOptions
): PaymentGatewayPort {
  const now = options.now ?? Date.now;
  return {
    async readPaymentBySubject(input): Promise<GatewayReadResult> {
      const started = now();
      try {
        const result = await withEncounterTimeout(
          gateway.readPaymentBySubject(input),
          options.timeoutMs,
          { label: "payment_gateway" }
        );
        const latencyMs =
          result.latencyMs !== undefined ? result.latencyMs : Math.max(0, now() - started);
        options.onLatency?.({ latencyMs, timedOut: false });
        return result.latencyMs !== undefined ? result : { ...result, latencyMs };
      } catch (err) {
        const latencyMs = Math.max(0, now() - started);
        const timedOut =
          err instanceof EncounterExecutionTimeoutError ||
          (err instanceof Error && /TIMEOUT/i.test(err.message));
        options.onLatency?.({ latencyMs, timedOut: timedOut || latencyMs >= options.timeoutMs });
        if (timedOut) {
          return { ok: false, reason: "timeout", latencyMs };
        }
        return { ok: false, reason: "unavailable", latencyMs };
      }
    },
  };
}
