import { refreshOutboxRelayLagFromDb } from "./outbox-relay-lag-monitor";
import { countFailedOutboxRows, countPendingOutboxRows } from "./outbox-queue-counts";

let outboxPendingTotal = 0;
let outboxFailedTotal = 0;

export function readOutboxPendingTotalGauge(): number {
  return outboxPendingTotal;
}

export function setOutboxPendingTotalGauge(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    return;
  }
  outboxPendingTotal = value;
}

export function readOutboxFailedTotalGauge(): number {
  return outboxFailedTotal;
}

export function setOutboxFailedTotalGauge(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    return;
  }
  outboxFailedTotal = value;
}

/** Refresh pending-row gauge from admin DB (relay tick / metrics scrape). */
export async function refreshOutboxPendingGaugeFromDb(): Promise<void> {
  if (!process.env.DATABASE_URL_ADMIN?.trim()) {
    return;
  }
  try {
    outboxPendingTotal = await countPendingOutboxRows();
  } catch {
    // Keep last value on transient DB errors during scrape.
  }
}

/** Refresh failed-row gauge from admin DB (DEC-123 SLO alert source). */
export async function refreshOutboxFailedGaugeFromDb(): Promise<void> {
  if (!process.env.DATABASE_URL_ADMIN?.trim()) {
    return;
  }
  try {
    outboxFailedTotal = await countFailedOutboxRows();
  } catch {
    // Keep last value on transient DB errors during scrape.
  }
}

/** Refresh pending + failed + oldest-pending age gauges together. */
export async function refreshOutboxQueueGaugesFromDb(): Promise<void> {
  await Promise.all([
    refreshOutboxPendingGaugeFromDb(),
    refreshOutboxFailedGaugeFromDb(),
    refreshOutboxRelayLagFromDb(),
  ]);
}

/** Test-only — reset between specs. */
export function resetOutboxPendingMetricsForTests(): void {
  outboxPendingTotal = 0;
  outboxFailedTotal = 0;
}
