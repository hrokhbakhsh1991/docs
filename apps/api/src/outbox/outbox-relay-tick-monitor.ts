import { metricsRegistry } from "../observability/metrics";

let lastTickPublished = 0;
let lastTickFailed = 0;
let lastTickDeferred = 0;

/** Prior tick still running — scheduled poll dropped (OB-COND-03 / C3). */
export function recordOutboxRelayTickSkipped(): void {
  metricsRegistry.increment("outbox_relay_tick_skipped_total");
}

/** Completed relay tick — export throughput (OB-COND-04 / C4). */
export function recordOutboxRelayTickResult(result: {
  readonly published: number;
  readonly failed: number;
  readonly deferred: number;
}): void {
  metricsRegistry.increment("outbox_relay_tick_total");
  if (result.published > 0) {
    metricsRegistry.increment("outbox_relay_published_total", undefined, result.published);
  }
  lastTickPublished = result.published;
  lastTickFailed = result.failed;
  lastTickDeferred = result.deferred;
  metricsRegistry.observe("outbox_relay_published_last_tick", result.published);
  metricsRegistry.observe("outbox_relay_failed_last_tick", result.failed);
  metricsRegistry.observe("outbox_relay_deferred_last_tick", result.deferred);
}

export function readOutboxRelayTickSkippedTotal(): number {
  return metricsRegistry.getMetric("outbox_relay_tick_skipped_total");
}

export function readOutboxRelayPublishedTotal(): number {
  return metricsRegistry.getMetric("outbox_relay_published_total");
}

export function readOutboxRelayPublishedLastTick(): number {
  return lastTickPublished;
}

export function readOutboxRelayFailedLastTick(): number {
  return lastTickFailed;
}

export function readOutboxRelayDeferredLastTick(): number {
  return lastTickDeferred;
}

/** Test-only — reset tick monitor state between specs. */
export function resetOutboxRelayTickMonitorForTests(): void {
  lastTickPublished = 0;
  lastTickFailed = 0;
  lastTickDeferred = 0;
}
