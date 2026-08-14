/**
 * Mismatch calibration hypotheses (PR5-B).
 * Measurement only — never auto-fixes adapters or workflows.
 */

import type { FinanceCaseComparisonCategory } from "../comparison/comparison-taxonomy-types";
import type { FactCoverageReport } from "./fact-coverage";

export type MismatchCalibrationClass =
  | "none"
  | "adapter_translation_issue"
  | "missing_fact_coverage"
  | "operational_heuristic_drift"
  | "real_ambiguity";

export type MismatchCalibrationResult = {
  readonly calibrationClass: MismatchCalibrationClass;
  readonly rationale: string;
};

/**
 * Classify a comparison outcome into a calibration hypothesis.
 * Does not mutate CaseOutput or operational state.
 */
export function calibrateMismatch(input: {
  readonly category: FinanceCaseComparisonCategory;
  readonly coverage: FactCoverageReport;
  readonly degradedProviders?: readonly string[];
  readonly notes?: readonly string[];
}): MismatchCalibrationResult {
  if (input.category === "aligned") {
    return { calibrationClass: "none", rationale: "aligned" };
  }

  if (input.category === "uncomparable") {
    if (
      input.coverage.requiredUnknownFields > 0 ||
      input.coverage.requiredDegradedFields > 0 ||
      (input.degradedProviders?.length ?? 0) > 0
    ) {
      return {
        calibrationClass: "missing_fact_coverage",
        rationale: "uncomparable_due_to_unknown_or_degraded_required_facts",
      };
    }
    return {
      calibrationClass: "missing_fact_coverage",
      rationale: "uncomparable_incomplete_snapshot",
    };
  }

  // Hard mismatches with heavy unknown on required money/evidence → likely adapter gaps.
  const obligation = input.coverage.providers.find((p) => p.provider === "obligation");
  const evidence = input.coverage.providers.find((p) => p.provider === "evidence");
  const unknownRatio =
    input.coverage.requiredTotalFields === 0
      ? 0
      : input.coverage.requiredUnknownFields / input.coverage.requiredTotalFields;

  if (
    unknownRatio >= 0.25 ||
    (obligation !== undefined && obligation.unknown > 0) ||
    (evidence !== undefined && evidence.unknown > 0 && input.category === "reading_disagreement")
  ) {
    return {
      calibrationClass: "adapter_translation_issue",
      rationale: "required_fact_unknown_with_mismatch",
    };
  }

  if (
    input.category === "owner_disagreement" ||
    input.category === "reading_disagreement"
  ) {
    return {
      calibrationClass: "operational_heuristic_drift",
      rationale: `ops_vs_case_${input.category}`,
    };
  }

  if (
    input.category === "exception_disagreement" ||
    input.category === "eligibility_disagreement"
  ) {
    return {
      calibrationClass: "real_ambiguity",
      rationale: `edge_${input.category}`,
    };
  }

  return {
    calibrationClass: "real_ambiguity",
    rationale: input.notes?.[0] ?? "unclassified_mismatch",
  };
}
