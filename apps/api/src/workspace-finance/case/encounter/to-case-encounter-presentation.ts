/**
 * CaseEncounterView → presentation DTO (PR12-A).
 * Strips interpreter internals; UI never sees CaseOutput / FactSnapshot.
 */

import type { CaseEncounterView } from "@app-tour/finance-core/case";

import type { CaseEncounterPresentation } from "./case-encounter-presentation";

export function toCaseEncounterPresentation(
  view: CaseEncounterView
): CaseEncounterPresentation {
  return {
    subjectId: view.subjectId,
    subjectKind: view.subjectKind,
    caseKey: view.caseKey,
    reading: view.reading,
    owner: view.owner,
    lane: view.lane,
    primaryPosture: view.primaryPosture,
    decisionReady: view.decisionReady,
    allow: [...view.allow],
    forbid: [...view.forbid],
    auditAltitude: view.auditAltitude,
    explainability: {
      headline: view.explainability.headline,
      reading: view.explainability.reading,
      owner: view.explainability.owner,
      ownerSummary: view.explainability.ownerSummary,
      primaryPosture: view.explainability.primaryPosture,
      lane: view.explainability.lane,
      decisionReady: view.explainability.decisionReady,
      auditAltitude: view.explainability.auditAltitude,
    },
    confidence: {
      whyVisible: view.confidence.whyVisible,
      whyMineOrNot: view.confidence.whyMineOrNot,
      ifIWait: view.confidence.ifIWait,
      avoid: view.confidence.avoid,
    },
    completeness: {
      completenessClass: view.completeness.completenessClass,
      actReady: view.completeness.actReady,
      waitComplete: view.completeness.waitComplete,
      inspectForced: view.completeness.inspectForced,
      escalateForced: view.completeness.escalateForced,
      displayToken: view.completeness.displayToken,
    },
    discoveryAttention:
      view.discoveryAttention === null
        ? null
        : {
            attentionClass: view.discoveryAttention.attentionClass,
            ...(view.discoveryAttention.reasonCode !== undefined
              ? { reasonCode: view.discoveryAttention.reasonCode }
              : {}),
          },
  };
}

/**
 * Prove presentation JSON has no CaseOutput / FactSnapshot / gateway leakage keys.
 */
export function assertPresentationBoundary(presentation: CaseEncounterPresentation): void {
  const json = JSON.stringify(presentation);
  if (
    /"facts"|"FactSnapshot"|"caseOutput"|"providers"|"stripe"|"pi_"/i.test(json) ||
    json.includes("paymentIntent") ||
    json.includes("externalPaymentRef")
  ) {
    throw new Error("CASE_ENCOUNTER_PRESENTATION_BOUNDARY_VIOLATION");
  }
}
