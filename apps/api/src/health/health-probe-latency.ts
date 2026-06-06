const DEFAULT_PROBE_BUDGET_MS = 500;
const SAMPLE_CAPACITY = 128;

const samples: number[] = [];
let sampleWriteIndex = 0;
let sampleCount = 0;
let slowProbeTotal = 0;
let lastProbeDurationMs = 0;

export function resolveHealthProbeLatencyBudgetMs(): number {
  const raw = process.env.HEALTH_PROBE_LATENCY_BUDGET_MS?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_PROBE_BUDGET_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PROBE_BUDGET_MS;
  }
  return Math.floor(parsed);
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

export function recordHealthProbeDuration(durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return;
  }

  lastProbeDurationMs = durationMs;
  samples[sampleWriteIndex] = durationMs;
  sampleWriteIndex = (sampleWriteIndex + 1) % SAMPLE_CAPACITY;
  if (sampleCount < SAMPLE_CAPACITY) {
    sampleCount += 1;
  }

  if (durationMs > resolveHealthProbeLatencyBudgetMs()) {
    slowProbeTotal += 1;
  }
}

export function readHealthProbeLastDurationMs(): number {
  return lastProbeDurationMs;
}

export function readHealthProbeP99Ms(): number {
  if (sampleCount === 0) {
    return 0;
  }
  const active =
    sampleCount < SAMPLE_CAPACITY
      ? samples.slice(0, sampleCount)
      : [...samples.slice(sampleWriteIndex), ...samples.slice(0, sampleWriteIndex)];
  return percentile(active, 99);
}

export function readHealthProbeSlowTotal(): number {
  return slowProbeTotal;
}

/** Test-only — reset probe latency samples between specs. */
export function resetHealthProbeLatencyMonitorForTests(): void {
  samples.length = 0;
  sampleWriteIndex = 0;
  sampleCount = 0;
  slowProbeTotal = 0;
  lastProbeDurationMs = 0;
}
