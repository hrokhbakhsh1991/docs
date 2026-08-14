/**
 * PR16-C — Shadow rollout decision gate (report-only).
 * Never auto-applies flags; never blocks FinanceService.
 */

import type { FinanceCaseShadowValidationReport } from "./build-finance-case-shadow-validation-report";

export type FinanceCaseShadowDecisionKind =
  | "READY_FOR_NEXT_STAGE"
  | "HOLD_FOR_CALIBRATION";

export type FinanceCaseShadowDecision = {
  readonly kind: FinanceCaseShadowDecisionKind;
  readonly reasons: readonly string[];
  readonly deferred: readonly string[];
  readonly report: FinanceCaseShadowValidationReport;
  readonly criteria: {
    readonly highVerdictParity: boolean;
    readonly noCriticalOwnershipMismatch: boolean;
    readonly noMissingRequiredFacts: boolean;
    readonly mismatchCausesUnderstood: boolean;
  };
  readonly mutatesFlags: false;
  readonly autoRemediation: false;
};

export type ResolveFinanceCaseShadowDecisionInput = {
  readonly report: FinanceCaseShadowValidationReport;
  /** Minimum verdict match among comparable (default 0.85). */
  readonly verdictParityThreshold?: number;
  /** When true, zero comparisons → HOLD (live window required). */
  readonly requireComparisons?: boolean;
};

export const SHADOW_DECISION_DEFERRED = [
  "UI Case actions",
  "replacing classic receipt review",
  "command buttons",
  "public rollout",
  "auto remediation",
] as const;

/**
 * Decide READY vs HOLD from a shadow validation report.
 */
export function resolveFinanceCaseShadowDecision(
  input: ResolveFinanceCaseShadowDecisionInput
): FinanceCaseShadowDecision {
  const threshold = input.verdictParityThreshold ?? 0.85;
  const report = input.report;
  const reasons: string[] = [];

  const requireComparisons = input.requireComparisons !== false;
  if (requireComparisons && report.totalComparisons === 0) {
    reasons.push("zero_comparisons_live_window_required");
  }

  const highVerdictParity =
    report.verdictMatchPct !== null && report.verdictMatchPct >= threshold;
  if (!highVerdictParity) {
    reasons.push(
      report.verdictMatchPct === null
        ? "verdict_parity_unavailable"
        : `verdict_parity_below_threshold:${report.verdictMatchPct.toFixed(3)}<${threshold}`
    );
  }

  const noCriticalOwnershipMismatch = report.criticalOwnershipMismatchCount === 0;
  if (!noCriticalOwnershipMismatch) {
    reasons.push(`critical_ownership_mismatch:${report.criticalOwnershipMismatchCount}`);
  }

  const noMissingRequiredFacts = report.missingRequiredFactCount === 0;
  if (!noMissingRequiredFacts) {
    reasons.push(`missing_required_facts:${report.missingRequiredFactCount}`);
  }

  const mismatchCausesUnderstood = report.unexplainedVerdictDivergenceCount === 0;
  if (!mismatchCausesUnderstood) {
    reasons.push(
      `unexplained_verdict_divergence:${report.unexplainedVerdictDivergenceCount}`
    );
  }

  const ready =
    (report.totalComparisons > 0 || !requireComparisons) &&
    highVerdictParity &&
    noCriticalOwnershipMismatch &&
    noMissingRequiredFacts &&
    mismatchCausesUnderstood &&
    reasons.length === 0;

  if (ready) {
    reasons.push("high_verdict_parity");
    reasons.push("no_critical_ownership_mismatch");
    reasons.push("no_missing_required_facts");
    reasons.push("mismatch_causes_understood");
  }

  return {
    kind: ready ? "READY_FOR_NEXT_STAGE" : "HOLD_FOR_CALIBRATION",
    reasons,
    deferred: [...SHADOW_DECISION_DEFERRED],
    report,
    criteria: {
      highVerdictParity,
      noCriticalOwnershipMismatch,
      noMissingRequiredFacts,
      mismatchCausesUnderstood,
    },
    mutatesFlags: false,
    autoRemediation: false,
  };
}
