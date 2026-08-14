/**
 * Comparison observation events + telemetry sink (PR5-A / PR16-B).
 */

import type {
  FinanceCaseComparisonCategory,
  ShadowMismatchTaxonomyCode,
} from "./comparison-taxonomy-types";
import type { InterpreterClassification } from "./compare-finance-case-observation";
import type { OperationalObservation } from "./operational-observation";

export type FinanceCaseComparisonObservation = {
  readonly executionId: string | null;
  readonly observationId: string;
  readonly caseKey: string | null;
  readonly triggerSource: string;
  readonly category: FinanceCaseComparisonCategory;
  /** PR16-B operator-facing mismatch code. */
  readonly taxonomyCode: ShadowMismatchTaxonomyCode;
  readonly interpreter: InterpreterClassification | null;
  readonly operational: {
    readonly followUpOwner: OperationalObservation["followUpOwner"] | null;
    readonly financeCategory: OperationalObservation["financeCategory"] | null;
    readonly pendingReceiptQueue: boolean | null;
    readonly collectionAttempted: boolean | null;
    readonly closedWithPossibleLeftovers: boolean | null;
  } | null;
  readonly degradedProviders: readonly string[];
  readonly notes: readonly string[];
  readonly latency: {
    readonly executionDurationMs: number | null;
    readonly assembleDurationMs: number | null;
    readonly interpreterDurationMs: number | null;
    readonly comparisonDurationMs: number | null;
    readonly shadowDurationMs: number | null;
  };
  readonly recordedAtMs: number;
};

export type FinanceCaseComparisonMetrics = {
  readonly shadowExecutions: number;
  readonly comparableRuns: number;
  readonly uncomparableRuns: number;
  readonly mismatchByCategory: Readonly<Record<string, number>>;
  readonly providerDegradationEvents: number;
  readonly interpreterFailures: number;
  readonly comparisonDurationTotalMs: number;
};

export type FinanceCaseComparisonEmitter = {
  readonly emit: (observation: FinanceCaseComparisonObservation) => void | Promise<void>;
};

type MutableFinanceCaseComparisonMetrics = {
  -readonly [K in keyof FinanceCaseComparisonMetrics]: FinanceCaseComparisonMetrics[K];
};

export function createInMemoryFinanceCaseComparisonEmitter(): FinanceCaseComparisonEmitter & {
  readonly observations: FinanceCaseComparisonObservation[];
  readonly metrics: FinanceCaseComparisonMetrics;
} {
  const observations: FinanceCaseComparisonObservation[] = [];
  const mismatchByCategory: Record<string, number> = {};
  const metrics: MutableFinanceCaseComparisonMetrics = {
    shadowExecutions: 0,
    comparableRuns: 0,
    uncomparableRuns: 0,
    mismatchByCategory,
    providerDegradationEvents: 0,
    interpreterFailures: 0,
    comparisonDurationTotalMs: 0,
  };

  return {
    observations,
    metrics,
    emit(observation) {
      observations.push(observation);
      metrics.shadowExecutions += 1;
      if (observation.category === "uncomparable") {
        metrics.uncomparableRuns += 1;
      } else {
        metrics.comparableRuns += 1;
      }
      if (observation.category !== "aligned" && observation.category !== "uncomparable") {
        mismatchByCategory[observation.category] =
          (mismatchByCategory[observation.category] ?? 0) + 1;
      }
      if (observation.degradedProviders.length > 0) {
        metrics.providerDegradationEvents += 1;
      }
      if (observation.interpreter === null && observation.category === "uncomparable") {
        metrics.interpreterFailures += 1;
      }
      metrics.comparisonDurationTotalMs +=
        observation.latency.comparisonDurationMs ?? 0;
    },
  };
}

export function summarizeOperationalForObservation(
  ops: OperationalObservation | null
): FinanceCaseComparisonObservation["operational"] {
  if (ops === null) {
    return null;
  }
  return {
    followUpOwner: ops.followUpOwner,
    financeCategory: ops.financeCategory,
    pendingReceiptQueue: ops.pendingReceiptQueue,
    collectionAttempted: ops.collectionAttempted,
    closedWithPossibleLeftovers: ops.closedWithPossibleLeftovers,
  };
}
