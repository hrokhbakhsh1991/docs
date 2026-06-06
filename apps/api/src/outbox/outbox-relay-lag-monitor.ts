import { queryOldestPendingOutboxCreatedAt } from "./outbox-queue-counts";

let oldestPendingAgeSeconds = 0;

/** Wall-clock lag from oldest pending row to now (F1). */
export function computeOutboxRelayLagSeconds(
  oldestCreatedAt: Date | null,
  nowMs = Date.now()
): number {
  if (oldestCreatedAt === null) {
    return 0;
  }
  const ageMs = nowMs - oldestCreatedAt.getTime();
  if (!Number.isFinite(ageMs) || ageMs <= 0) {
    return 0;
  }
  return ageMs / 1000;
}

export function readOutboxRelayOldestPendingAgeSeconds(): number {
  return oldestPendingAgeSeconds;
}

export function setOutboxRelayOldestPendingAgeSeconds(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    return;
  }
  oldestPendingAgeSeconds = value;
}

/** Refresh oldest-pending age from admin DB (relay tick / metrics scrape). */
export async function refreshOutboxRelayLagFromDb(nowMs = Date.now()): Promise<void> {
  if (!process.env.DATABASE_URL_ADMIN?.trim()) {
    return;
  }
  try {
    const oldest = await queryOldestPendingOutboxCreatedAt();
    oldestPendingAgeSeconds = computeOutboxRelayLagSeconds(oldest, nowMs);
  } catch {
    // Keep last value on transient DB errors during scrape.
  }
}

/** Test-only — reset lag gauge between specs. */
export function resetOutboxRelayLagMonitorForTests(): void {
  oldestPendingAgeSeconds = 0;
}
