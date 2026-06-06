/**
 * RB-GAP-11 — stop live DB feature-flag reads during rollback window (DEC-120).
 * @see docs/phase-5/appendices/prod-cache-invalidate-service-jwt.md
 */

const DEFAULT_FREEZE_SECONDS = 600;

let inMemoryFreezeUntilMs: number | null = null;

export function resolveFeatureFlagFreezeDefaultSeconds(): number {
  const raw = process.env.FEATURE_FLAG_FREEZE_DEFAULT_SEC?.trim();
  if (!raw) {
    return DEFAULT_FREEZE_SECONDS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_FREEZE_SECONDS;
}

function readBootFreezeUntilMs(): number | null {
  const raw = process.env.FEATURE_FLAG_FREEZE_UNTIL?.trim();
  if (raw === undefined || raw.length === 0) {
    return null;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function activeFreezeUntilMs(): number | null {
  const boot = readBootFreezeUntilMs();
  const candidates = [boot, inMemoryFreezeUntilMs].filter(
    (value): value is number => value !== null
  );
  if (candidates.length === 0) {
    return null;
  }
  return Math.max(...candidates);
}

export function isFeatureFlagFreezeActive(): boolean {
  const until = activeFreezeUntilMs();
  return until !== null && Date.now() < until;
}

export function activateFeatureFlagFreeze(seconds?: number): Date {
  const durationSec = seconds ?? resolveFeatureFlagFreezeDefaultSeconds();
  const clamped = Math.min(Math.max(durationSec, 1), 3600);
  inMemoryFreezeUntilMs = Date.now() + clamped * 1000;
  return new Date(inMemoryFreezeUntilMs);
}

export function readFeatureFlagFreezeUntilForTests(): Date | null {
  const until = activeFreezeUntilMs();
  return until === null ? null : new Date(until);
}

/** Test-only — reset in-memory freeze between specs. */
export function resetFeatureFlagFreezeForTests(): void {
  inMemoryFreezeUntilMs = null;
}
