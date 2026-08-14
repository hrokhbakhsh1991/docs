/**
 * Read-only Case Encounter View Model (PR6-A).
 * Presentation projection of ephemeral CaseOutput — not a status, not a repository row.
 */

import type { CaseSubjectKind } from "../facts/fact-groups";
import type {
  CaseAllowAction,
  CaseForbidAction,
  CaseLane,
  CaseOwner,
  CasePosture,
  CaseReading,
  CompletenessClass,
  ConfidenceQuartet,
} from "../output/case-output";
import type { EncounterAttention } from "../snapshot/fact-snapshot";

/** Explainability summary derived solely from CaseOutput fields. */
export type CaseEncounterExplainability = {
  readonly headline: string;
  readonly reading: CaseReading;
  readonly owner: CaseOwner;
  readonly ownerSummary: string;
  readonly primaryPosture: CasePosture;
  readonly lane: CaseLane;
  readonly decisionReady: boolean;
  readonly auditAltitude: boolean;
};

/** Confidence presentation — mirrors ConfidenceQuartet without re-deriving rules. */
export type CaseEncounterConfidencePresentation = ConfidenceQuartet;

/**
 * Completeness display indicators.
 * Flags are projections of completenessClass — they do not re-run completeness rules.
 */
export type CaseEncounterCompletenessIndicator = {
  readonly completenessClass: CompletenessClass;
  readonly actReady: boolean;
  readonly waitComplete: boolean;
  readonly inspectForced: boolean;
  readonly escalateForced: boolean;
  /** Stable presentation token for UI copy keys (not localized here). */
  readonly displayToken: CompletenessClass;
};

/**
 * First consumption boundary for CaseOutput.
 * Interpreter remains the source of meaning; this type does not invent verdicts.
 */
export type CaseEncounterView = {
  readonly subjectId: string;
  readonly subjectKind: CaseSubjectKind;
  readonly caseKey: string;
  readonly reading: CaseReading;
  readonly owner: CaseOwner;
  readonly lane: CaseLane;
  readonly primaryPosture: CasePosture;
  readonly decisionReady: boolean;
  readonly allow: readonly CaseAllowAction[];
  readonly forbid: readonly CaseForbidAction[];
  readonly auditAltitude: boolean;
  readonly explainability: CaseEncounterExplainability;
  readonly confidence: CaseEncounterConfidencePresentation;
  readonly completeness: CaseEncounterCompletenessIndicator;
  /**
   * Discovery-only “why opened” cue.
   * Must never be used to derive reading / owner / lane / posture / allow / forbid.
   */
  readonly discoveryAttention: EncounterAttention | null;
};

export type ProjectCaseEncounterOptions = {
  readonly discoveryAttention?: EncounterAttention | null;
};
