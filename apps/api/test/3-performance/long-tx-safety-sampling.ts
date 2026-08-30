/**
 * Pure helpers for long-tx-safety pg_stat_activity sampling.
 * Sustained-positive rule: fail only when delta > 0 on 2+ consecutive samples.
 */

export const LONG_TX_REQUIRED_CONSECUTIVE_POSITIVE_SAMPLES = 2;

export type LongTxSamplingVerdict = {
  readonly sustainedViolation: boolean;
  readonly maxDelta: number;
  readonly maxConsecutivePositive: number;
  readonly isolatedPositiveSampleCount: number;
};

export type LongTxActivityDiagnostic = {
  readonly pid: number;
  readonly state: string;
  readonly query: string;
  readonly xactStart: string | null;
  readonly stateChange: string | null;
};

export function evaluateIdleInTxDeltaSamples(
  deltas: readonly number[],
  requiredConsecutivePositive = LONG_TX_REQUIRED_CONSECUTIVE_POSITIVE_SAMPLES
): LongTxSamplingVerdict {
  let maxDelta = 0;
  let consecutivePositive = 0;
  let maxConsecutivePositive = 0;
  let isolatedPositiveSampleCount = 0;

  for (const delta of deltas) {
    if (delta > maxDelta) {
      maxDelta = delta;
    }
    if (delta > 0) {
      consecutivePositive += 1;
      if (consecutivePositive > maxConsecutivePositive) {
        maxConsecutivePositive = consecutivePositive;
      }
      continue;
    }
    if (consecutivePositive === 1) {
      isolatedPositiveSampleCount += 1;
    }
    consecutivePositive = 0;
  }

  if (consecutivePositive === 1) {
    isolatedPositiveSampleCount += 1;
  }

  return {
    sustainedViolation: maxConsecutivePositive >= requiredConsecutivePositive,
    maxDelta,
    maxConsecutivePositive,
    isolatedPositiveSampleCount,
  };
}

export function formatLongTxActivityDiagnostics(
  diagnostics: readonly LongTxActivityDiagnostic[]
): string {
  if (diagnostics.length === 0) {
    return "  (no idle-in-transaction backends captured)";
  }
  return diagnostics
    .map((row, index) =>
      [
        `  [${index + 1}] pid=${row.pid} state=${row.state}`,
        `      xact_start=${row.xactStart ?? "null"}`,
        `      state_change=${row.stateChange ?? "null"}`,
        `      query=${row.query.trim().slice(0, 200) || "(empty)"}`,
      ].join("\n")
    )
    .join("\n");
}

export function formatLongTxSustainedViolationMessage(input: {
  baselineIdleInTransaction: number;
  verdict: LongTxSamplingVerdict;
  validateDelayMs: number;
  validationSampleCount: number;
  sampleWindowMs: string;
  diagnostics: readonly LongTxActivityDiagnostic[];
}): string {
  return [
    "sustained idle in transaction during validation delay — TX opened before persist (architecture bug)",
    `  baseline=${input.baselineIdleInTransaction} maxDelta=${input.verdict.maxDelta}`,
    `  maxConsecutivePositive=${input.verdict.maxConsecutivePositive} required=${LONG_TX_REQUIRED_CONSECUTIVE_POSITIVE_SAMPLES}`,
    `  isolatedPositiveSamples=${input.verdict.isolatedPositiveSampleCount}`,
    `  validateDelayMs=${input.validateDelayMs} samples=${input.validationSampleCount}`,
    `  sampleWindowMs=${input.sampleWindowMs}`,
    "  pg_stat_activity diagnostics:",
    formatLongTxActivityDiagnostics(input.diagnostics),
  ].join("\n");
}
