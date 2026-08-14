/**
 * Report-only quality gates for shadow observation (PR5-B).
 * Never blocks primary workflow.
 */

import type { FinanceCaseComparisonCategory } from "../comparison/comparison-taxonomy-types";
import type { FactCoverageReport } from "./fact-coverage";
import type { MismatchCalibrationClass } from "./mismatch-calibration";

export type FinanceCaseQualityGateThresholds = {
  /** Max exception_disagreement / comparableRuns (default 0.2). */
  readonly maxExceptionDisagreementRate: number;
  /** Max requiredUnknownFields / requiredTotalFields across window (default 0.35). */
  readonly maxRequiredUnknownFactRate: number;
  /** Max providerDegradationEvents / shadowExecutions (default 0.25). */
  readonly maxProviderFailureRate: number;
  /** Min comparableRuns / shadowExecutions (default 0.5). */
  readonly minComparisonCoverageRate: number;
};

export const DEFAULT_FINANCE_CASE_QUALITY_GATE_THRESHOLDS: FinanceCaseQualityGateThresholds = {
  maxExceptionDisagreementRate: 0.2,
  maxRequiredUnknownFactRate: 0.35,
  maxProviderFailureRate: 0.25,
  minComparisonCoverageRate: 0.5,
};

export type FinanceCaseQualityGateCounters = {
  readonly shadowExecutions: number;
  readonly comparableRuns: number;
  readonly exceptionDisagreements: number;
  readonly providerDegradationEvents: number;
  readonly requiredUnknownFields: number;
  readonly requiredTotalFields: number;
};

export type FinanceCaseQualityGateFinding = {
  readonly gate: string;
  readonly ok: boolean;
  readonly actual: number;
  readonly threshold: number;
};

export type FinanceCaseQualityGateReport = {
  readonly ok: boolean;
  readonly findings: readonly FinanceCaseQualityGateFinding[];
  /** Always false for PR5-B — gates must not block requests. */
  readonly blocksWorkflow: false;
};

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

export function evaluateFinanceCaseQualityGates(
  counters: FinanceCaseQualityGateCounters,
  thresholds: FinanceCaseQualityGateThresholds = DEFAULT_FINANCE_CASE_QUALITY_GATE_THRESHOLDS
): FinanceCaseQualityGateReport {
  const findings: FinanceCaseQualityGateFinding[] = [
    {
      gate: "exception_disagreement_rate",
      ok:
        rate(counters.exceptionDisagreements, counters.comparableRuns) <=
        thresholds.maxExceptionDisagreementRate,
      actual: rate(counters.exceptionDisagreements, counters.comparableRuns),
      threshold: thresholds.maxExceptionDisagreementRate,
    },
    {
      gate: "required_unknown_fact_rate",
      ok:
        rate(counters.requiredUnknownFields, counters.requiredTotalFields) <=
        thresholds.maxRequiredUnknownFactRate,
      actual: rate(counters.requiredUnknownFields, counters.requiredTotalFields),
      threshold: thresholds.maxRequiredUnknownFactRate,
    },
    {
      gate: "provider_failure_rate",
      ok:
        rate(counters.providerDegradationEvents, counters.shadowExecutions) <=
        thresholds.maxProviderFailureRate,
      actual: rate(counters.providerDegradationEvents, counters.shadowExecutions),
      threshold: thresholds.maxProviderFailureRate,
    },
    {
      gate: "comparison_coverage_rate",
      ok:
        rate(counters.comparableRuns, counters.shadowExecutions) >=
        thresholds.minComparisonCoverageRate,
      actual: rate(counters.comparableRuns, counters.shadowExecutions),
      threshold: thresholds.minComparisonCoverageRate,
    },
  ];

  return {
    ok: findings.every((f) => f.ok),
    findings,
    blocksWorkflow: false,
  };
}

export type ProductionObservationRecord = {
  readonly executionId: string | null;
  readonly observationId: string;
  readonly caseKey: string | null;
  readonly triggerSource: string;
  readonly comparisonCategory: FinanceCaseComparisonCategory;
  readonly calibrationClass: MismatchCalibrationClass;
  readonly coverage: FactCoverageReport;
  readonly degradedProviders: readonly string[];
  readonly latencyMs: {
    readonly execution: number | null;
    readonly assemble: number | null;
    readonly interpreter: number | null;
    readonly comparison: number | null;
    readonly shadow: number | null;
  };
  readonly recordedAtMs: number;
};
