/**
 * Pure CaseOutput → CaseEncounterView projection (PR6-A).
 * No rules/*, no writes, no Denali, no interpretation.
 */

import type { CaseOutput, CompletenessClass } from "../output/case-output";
import type {
  CaseEncounterCompletenessIndicator,
  CaseEncounterExplainability,
  CaseEncounterView,
  ProjectCaseEncounterOptions,
} from "./case-encounter-view";

function projectCompleteness(
  completenessClass: CompletenessClass
): CaseEncounterCompletenessIndicator {
  return {
    completenessClass,
    actReady: completenessClass === "act_complete",
    waitComplete: completenessClass === "wait_complete",
    inspectForced: completenessClass === "inspect_forced",
    escalateForced: completenessClass === "escalate_forced",
    displayToken: completenessClass,
  };
}

function projectExplainability(caseOutput: CaseOutput): CaseEncounterExplainability {
  return {
    headline: caseOutput.interpretationSentence,
    reading: caseOutput.reading,
    owner: caseOutput.owner,
    ownerSummary: caseOutput.whyOwner,
    primaryPosture: caseOutput.primaryPosture,
    lane: caseOutput.lane,
    decisionReady: caseOutput.decisionReady,
    auditAltitude: caseOutput.auditAltitude,
  };
}

/**
 * Map ephemeral CaseOutput into a read-only encounter view.
 * Deterministic: same CaseOutput (+ same optional attention) → same view.
 */
export function projectCaseEncounter(
  caseOutput: CaseOutput,
  options?: ProjectCaseEncounterOptions
): CaseEncounterView {
  const attention = options?.discoveryAttention ?? null;
  return {
    subjectId: caseOutput.subjectId,
    subjectKind: caseOutput.subjectKind,
    caseKey: caseOutput.caseKey,
    reading: caseOutput.reading,
    owner: caseOutput.owner,
    lane: caseOutput.lane,
    primaryPosture: caseOutput.primaryPosture,
    decisionReady: caseOutput.decisionReady,
    allow: caseOutput.allow,
    forbid: caseOutput.forbid,
    auditAltitude: caseOutput.auditAltitude,
    explainability: projectExplainability(caseOutput),
    confidence: {
      whyVisible: caseOutput.confidence.whyVisible,
      whyMineOrNot: caseOutput.confidence.whyMineOrNot,
      ifIWait: caseOutput.confidence.ifIWait,
      avoid: caseOutput.confidence.avoid,
    },
    completeness: projectCompleteness(caseOutput.completenessClass),
    discoveryAttention: attention,
  };
}
