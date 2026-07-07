import type { ExposureDecision, ExposureDecisionState } from "@app-tour/platform-core";

import type { DriftClassification } from "./classify-shadow-drift";

export type ShadowParityMismatchType = "FIELD_MISSING" | "FIELD_EXTRA" | "STATE_MISMATCH";

export type ShadowFieldParityReport = {
  readonly fieldId: string;
  readonly shadowState: ExposureDecisionState;
  readonly isPresentInEligibleFields: boolean;
  readonly isPresentInCandidateFields: boolean;
  readonly mismatch: ShadowParityMismatchType | null;
  /** Populated by drift classification layer — not by parity comparison itself. */
  readonly driftClassification?: DriftClassification | null;
};

export type ShadowParityReport = {
  readonly matches: boolean;
  readonly fieldReports: readonly ShadowFieldParityReport[];
  readonly mismatchCount: number;
};

const EXPOSED_SHADOW_STATES: ReadonlySet<ExposureDecisionState> = new Set([
  "visible",
  "redacted",
  "summary_only",
]);

const RESTRICTED_SHADOW_STATES: ReadonlySet<ExposureDecisionState> = new Set([
  "hidden",
  "blocked",
]);

function resolveShadowParityMismatch(input: {
  readonly shadowState: ExposureDecisionState;
  readonly isPresentInEligibleFields: boolean;
}): ShadowParityMismatchType | null {
  if (
    EXPOSED_SHADOW_STATES.has(input.shadowState) &&
    !input.isPresentInEligibleFields
  ) {
    return "FIELD_MISSING";
  }

  if (
    input.isPresentInEligibleFields &&
    RESTRICTED_SHADOW_STATES.has(input.shadowState)
  ) {
    return "FIELD_EXTRA";
  }

  if (
    input.isPresentInEligibleFields &&
    (input.shadowState === "redacted" || input.shadowState === "summary_only")
  ) {
    return "STATE_MISMATCH";
  }

  return null;
}

export function compareShadowVsLegacy(input: {
  readonly legacyEligibleFieldIds: readonly string[];
  readonly legacyCandidateFieldIds: readonly string[];
  readonly shadowDecisionMap: ReadonlyMap<string, ExposureDecision>;
}): ShadowParityReport {
  const eligible = new Set(input.legacyEligibleFieldIds);
  const candidate = new Set(input.legacyCandidateFieldIds);
  const fieldReports: ShadowFieldParityReport[] = [];

  for (const [fieldId, decision] of input.shadowDecisionMap) {
    const isPresentInEligibleFields = eligible.has(fieldId);
    const isPresentInCandidateFields = candidate.has(fieldId);
    const mismatch = resolveShadowParityMismatch({
      shadowState: decision.state,
      isPresentInEligibleFields,
    });

    fieldReports.push({
      fieldId,
      shadowState: decision.state,
      isPresentInEligibleFields,
      isPresentInCandidateFields,
      mismatch,
    });
  }

  fieldReports.sort((left, right) => left.fieldId.localeCompare(right.fieldId));

  const mismatchCount = fieldReports.filter((report) => report.mismatch !== null).length;

  return {
    matches: mismatchCount === 0,
    fieldReports,
    mismatchCount,
  };
}
