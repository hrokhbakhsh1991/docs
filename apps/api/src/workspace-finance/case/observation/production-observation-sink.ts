/**
 * Production observation sink (PR5-B) — counters + latency only.
 * Fail-open; never Case persistence concepts.
 */

import type { FinanceCaseComparisonObservation } from "../comparison/comparison-observation";
import { buildFactCoverageReport, type FactCoverageReport } from "./fact-coverage";
import { calibrateMismatch, type MismatchCalibrationClass } from "./mismatch-calibration";
import {
  DEFAULT_FINANCE_CASE_QUALITY_GATE_THRESHOLDS,
  evaluateFinanceCaseQualityGates,
  type FinanceCaseQualityGateCounters,
  type FinanceCaseQualityGateReport,
  type FinanceCaseQualityGateThresholds,
  type ProductionObservationRecord,
} from "./quality-gates";
import type { FactSnapshot } from "@app-tour/finance-core/case";

export type ProductionObservationMetrics = {
  readonly executionCount: number;
  readonly comparableCount: number;
  readonly uncomparableCount: number;
  readonly mismatchByCategory: Readonly<Record<string, number>>;
  readonly calibrationByClass: Readonly<Record<string, number>>;
  readonly providerDegradationCount: number;
  readonly latencyTotalMs: {
    execution: number;
    assemble: number;
    interpreter: number;
    comparison: number;
    shadow: number;
  };
  readonly coverageTotals: {
    requiredUnknownFields: number;
    requiredDegradedFields: number;
    requiredTotalFields: number;
  };
};

export type ProductionObservationSink = {
  readonly record: (input: {
    readonly comparison: FinanceCaseComparisonObservation;
    readonly snapshot: FactSnapshot | null;
  }) => void | Promise<void>;
  readonly snapshotMetrics: () => ProductionObservationMetrics;
  readonly evaluateQualityGates: (
    thresholds?: FinanceCaseQualityGateThresholds
  ) => FinanceCaseQualityGateReport;
};

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

/**
 * In-process production sink for calibration windows.
 * Sink failures must be caught by callers (schedule path already swallows).
 */
export function createProductionObservationSink(): ProductionObservationSink & {
  readonly records: ProductionObservationRecord[];
} {
  const records: ProductionObservationRecord[] = [];
  const mismatchByCategory: Record<string, number> = {};
  const calibrationByClass: Record<string, number> = {};
  const latencyTotalMs = {
    execution: 0,
    assemble: 0,
    interpreter: 0,
    comparison: 0,
    shadow: 0,
  };
  const coverageTotals = {
    requiredUnknownFields: 0,
    requiredDegradedFields: 0,
    requiredTotalFields: 0,
  };
  let executionCount = 0;
  let comparableCount = 0;
  let uncomparableCount = 0;
  let providerDegradationCount = 0;
  let exceptionDisagreements = 0;

  const sink: ProductionObservationSink & { readonly records: ProductionObservationRecord[] } = {
    records,
    async record(input) {
      const coverage = buildFactCoverageReport({
        snapshot: input.snapshot,
        degradedProviders: input.comparison.degradedProviders,
      });
      const calibration = calibrateMismatch({
        category: input.comparison.category,
        coverage,
        degradedProviders: input.comparison.degradedProviders,
        notes: input.comparison.notes,
      });

      const record: ProductionObservationRecord = {
        executionId: input.comparison.executionId,
        observationId: input.comparison.observationId,
        caseKey: input.comparison.caseKey,
        triggerSource: input.comparison.triggerSource,
        comparisonCategory: input.comparison.category,
        calibrationClass: calibration.calibrationClass,
        coverage,
        degradedProviders: input.comparison.degradedProviders,
        latencyMs: {
          execution: input.comparison.latency.executionDurationMs,
          assemble: input.comparison.latency.assembleDurationMs,
          interpreter: input.comparison.latency.interpreterDurationMs,
          comparison: input.comparison.latency.comparisonDurationMs,
          shadow: input.comparison.latency.shadowDurationMs,
        },
        recordedAtMs: Date.now(),
      };
      records.push(record);

      executionCount += 1;
      if (input.comparison.category === "uncomparable") {
        uncomparableCount += 1;
      } else {
        comparableCount += 1;
      }
      if (
        input.comparison.category !== "aligned" &&
        input.comparison.category !== "uncomparable"
      ) {
        bump(mismatchByCategory, input.comparison.category);
      }
      if (input.comparison.category === "exception_disagreement") {
        exceptionDisagreements += 1;
      }
      bump(calibrationByClass, calibration.calibrationClass);
      if (input.comparison.degradedProviders.length > 0) {
        providerDegradationCount += 1;
      }
      latencyTotalMs.execution += input.comparison.latency.executionDurationMs ?? 0;
      latencyTotalMs.assemble += input.comparison.latency.assembleDurationMs ?? 0;
      latencyTotalMs.interpreter += input.comparison.latency.interpreterDurationMs ?? 0;
      latencyTotalMs.comparison += input.comparison.latency.comparisonDurationMs ?? 0;
      latencyTotalMs.shadow += input.comparison.latency.shadowDurationMs ?? 0;
      coverageTotals.requiredUnknownFields += coverage.requiredUnknownFields;
      coverageTotals.requiredDegradedFields += coverage.requiredDegradedFields;
      coverageTotals.requiredTotalFields += coverage.requiredTotalFields;
    },
    snapshotMetrics() {
      return {
        executionCount,
        comparableCount,
        uncomparableCount,
        mismatchByCategory: { ...mismatchByCategory },
        calibrationByClass: { ...calibrationByClass },
        providerDegradationCount,
        latencyTotalMs: { ...latencyTotalMs },
        coverageTotals: { ...coverageTotals },
      };
    },
    evaluateQualityGates(thresholds = DEFAULT_FINANCE_CASE_QUALITY_GATE_THRESHOLDS) {
      const counters: FinanceCaseQualityGateCounters = {
        shadowExecutions: executionCount,
        comparableRuns: comparableCount,
        exceptionDisagreements,
        providerDegradationEvents: providerDegradationCount,
        requiredUnknownFields: coverageTotals.requiredUnknownFields,
        requiredTotalFields: coverageTotals.requiredTotalFields,
      };
      return evaluateFinanceCaseQualityGates(counters, thresholds);
    },
  };

  return sink;
}

/** Assert metrics payload has no Case persistence vocabulary. */
export function assertObservationMetricsHaveNoPersistenceConcepts(
  metrics: ProductionObservationMetrics
): void {
  const blob = JSON.stringify(metrics);
  if (
    /caseStatus|case_status|ownerHistory|owner_timeline|workflowState|caseRepository|case_table/i.test(
      blob
    )
  ) {
    throw new Error("observation_metrics_contain_persistence_concepts");
  }
}

export type { FactCoverageReport, MismatchCalibrationClass };
