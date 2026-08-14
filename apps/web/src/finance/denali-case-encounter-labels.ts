/**
 * Denali presentation labels for Case Encounter (PR12-A / PR21-G5).
 * Product terminology only — never changes owner / posture / money meaning.
 */

import {
  DEFAULT_CASE_ENCOUNTER_LABELS,
  type CaseEncounterLabelBundle,
} from "@app-cloud/finance-case-encounter-ui";

type Translate = (key: string) => string;

/**
 * Build locale-aware encounter chrome from `finance.caseEncounter` messages.
 * Domain enums stay display labels only — no semantic remapping.
 */
export function buildCaseEncounterLabels(t: Translate): CaseEncounterLabelBundle {
  return {
    sections: {
      identity: t("sections.identity"),
      explanation: t("sections.explanation"),
      ownership: t("sections.ownership"),
      confidence: t("sections.confidence"),
      completeness: t("sections.completeness"),
      attention: t("sections.attention"),
      vocabularyHints: t("sections.vocabularyHints"),
      commandCapability: t("sections.commandCapability"),
    },
    fields: {
      caseKey: t("fields.caseKey"),
      subjectKind: t("fields.subjectKind"),
      subjectId: t("fields.subjectId"),
      counterparty: t("fields.counterparty"),
      reading: t("fields.reading"),
      headline: t("fields.headline"),
      owner: t("fields.owner"),
      ownerSummary: t("fields.ownerSummary"),
      lane: t("fields.lane"),
      posture: t("fields.posture"),
      decisionReady: t("fields.decisionReady"),
      whyVisible: t("fields.whyVisible"),
      whyMineOrNot: t("fields.whyMineOrNot"),
      ifIWait: t("fields.ifIWait"),
      avoid: t("fields.avoid"),
      completenessClass: t("fields.completenessClass"),
      allow: t("fields.allow"),
      forbid: t("fields.forbid"),
      refresh: t("fields.refresh"),
      loading: t("fields.loading"),
      loadError: t("fields.loadError"),
      noAttention: t("fields.noAttention"),
      supportedCommands: t("fields.supportedCommands"),
      availableTokens: t("fields.availableTokens"),
      capabilityEndpoint: t("fields.capabilityEndpoint"),
      noAvailableTokens: t("fields.noAvailableTokens"),
      capabilityReadOnlyNote: t("fields.capabilityReadOnlyNote"),
      executionId: t("fields.executionId"),
    },
    surfaceStates: {
      loading: t("surfaceStates.loading"),
      unavailable: t("surfaceStates.unavailable"),
      degraded: t("surfaceStates.degraded"),
      incomplete: t("surfaceStates.incomplete"),
      normal: t("surfaceStates.normal"),
    },
    attentionClass: {
      reconciliation_attention: t("attentionClass.reconciliation_attention"),
    },
    reading: {
      AWAITING_COUNTERPARTY: t("reading.AWAITING_COUNTERPARTY"),
      AWAITING_FINANCE: t("reading.AWAITING_FINANCE"),
      NO_MONEY_DUE: t("reading.NO_MONEY_DUE"),
      NOT_ELIGIBLE: t("reading.NOT_ELIGIBLE"),
      INTENT_OPEN_NO_PROOF: t("reading.INTENT_OPEN_NO_PROOF"),
      PARTIAL_SCOPED: t("reading.PARTIAL_SCOPED"),
      SETTLED_CAPTURED: t("reading.SETTLED_CAPTURED"),
      CLOSED_IDLE: t("reading.CLOSED_IDLE"),
      EXCEPTION: t("reading.EXCEPTION"),
      INCOMPLETE_INSPECT: t("reading.INCOMPLETE_INSPECT"),
    },
    owner: {
      finance: t("owner.finance"),
      counterparty: t("owner.counterparty"),
      product_desk: t("owner.product_desk"),
      policy_system: t("owner.policy_system"),
      exception_policy: t("owner.exception_policy"),
      audit: t("owner.audit"),
      idle: t("owner.idle"),
    },
    lane: {
      daily: t("lane.daily"),
      exception: t("lane.exception"),
      audit: t("lane.audit"),
    },
    posture: {
      act: t("posture.act"),
      wait: t("posture.wait"),
      inspect: t("posture.inspect"),
      escalate: t("posture.escalate"),
    },
    subjectKind: {
      enrollment: t("subjectKind.enrollment"),
      subscription: t("subjectKind.subscription"),
      buyer_payment: t("subjectKind.buyer_payment"),
      seller_payout: t("subjectKind.seller_payout"),
      dispute: t("subjectKind.dispute"),
      other: t("subjectKind.other"),
    },
    completeness: {
      act_complete: t("completeness.act_complete"),
      wait_complete: t("completeness.wait_complete"),
      inspect_forced: t("completeness.inspect_forced"),
      escalate_forced: t("completeness.escalate_forced"),
    },
  };
}

/** Static English Denali overlay (tests / non-locale call sites). */
export const DENALI_CASE_ENCOUNTER_LABELS: CaseEncounterLabelBundle = {
  ...DEFAULT_CASE_ENCOUNTER_LABELS,
  sections: {
    ...DEFAULT_CASE_ENCOUNTER_LABELS.sections,
    identity: "Commercial meaning",
    explanation: "Reasoning",
    ownership: "Ownership",
    confidence: "Confidence",
    completeness: "Completeness",
    attention: "Attention",
    commandCapability: "Command capability (read-only)",
  },
  fields: {
    ...DEFAULT_CASE_ENCOUNTER_LABELS.fields,
    refresh: "Refresh",
    loading: "Loading case…",
    loadError: "Could not load financial case",
    subjectKind: "Subject kind",
    subjectId: "Registration id",
    caseKey: "Case key",
    executionId: "Execution",
  },
  surfaceStates: {
    ...DEFAULT_CASE_ENCOUNTER_LABELS.surfaceStates,
    loading: "Loading case…",
    unavailable: "Financial case unavailable",
    degraded: "Case available with degraded facts",
    incomplete: "Case incomplete — inspect coverage",
    normal: "Case ready",
  },
  subjectKind: {
    ...DEFAULT_CASE_ENCOUNTER_LABELS.subjectKind,
    enrollment: "Enrollment registration",
  },
  attentionClass: {
    ...DEFAULT_CASE_ENCOUNTER_LABELS.attentionClass,
    reconciliation_attention:
      "Attention required: payment evidence differs from recorded settlement",
  },
};
