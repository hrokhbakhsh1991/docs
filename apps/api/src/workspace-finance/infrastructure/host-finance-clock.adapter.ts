/**
 * Host adapter — system wall clock for finance timestamps.
 */

import type { FinanceClockPort } from "../ports/finance-clock.port";

export class HostFinanceClockAdapter implements FinanceClockPort {
  nowIso(): string {
    return new Date().toISOString();
  }
}
