import type { CaseEncounterViewContract } from "./contract";

function baseEncounter(
  partial: Pick<CaseEncounterViewContract, "subjectId" | "subjectKind" | "caseKey"> &
    Partial<CaseEncounterViewContract>
): CaseEncounterViewContract {
  const reading = partial.reading ?? "AWAITING_COUNTERPARTY";
  const owner = partial.owner ?? "counterparty";
  const lane = partial.lane ?? "daily";
  const posture = partial.primaryPosture ?? "wait";
  const completenessClass = partial.completeness?.completenessClass ?? "wait_complete";
  const decisionReady = partial.decisionReady ?? false;
  const auditAltitude = partial.auditAltitude ?? false;
  return {
    subjectId: partial.subjectId,
    subjectKind: partial.subjectKind,
    caseKey: partial.caseKey,
    reading,
    owner,
    lane,
    primaryPosture: posture,
    decisionReady,
    allow: partial.allow ?? ["wait"],
    forbid: partial.forbid ?? ["create_payment_repair", "lifecycle_mutation"],
    auditAltitude,
    explainability: partial.explainability ?? {
      headline: "Waiting on counterparty proof",
      reading,
      owner,
      ownerSummary: "Counterparty owns the next evidence step",
      primaryPosture: posture,
      lane,
      decisionReady,
      auditAltitude,
    },
    confidence: partial.confidence ?? {
      whyVisible: "Unsettled obligation with no accepted proof",
      whyMineOrNot: "Not finance-owned until evidence is in review",
      ifIWait: "Counterparty may submit proof",
      avoid: "Do not create payment repair from Case",
    },
    completeness: partial.completeness ?? {
      completenessClass,
      actReady: completenessClass === "act_complete",
      waitComplete: completenessClass === "wait_complete",
      inspectForced: completenessClass === "inspect_forced",
      escalateForced: completenessClass === "escalate_forced",
      displayToken: completenessClass,
    },
    discoveryAttention: partial.discoveryAttention ?? null,
  };
}

/** A — Enrollment / manual receipt style subject. */
export function fixtureEnrollmentEncounter(
  attention?: CaseEncounterViewContract["discoveryAttention"]
): CaseEncounterViewContract {
  return baseEncounter({
    subjectId: "reg-enroll-1",
    subjectKind: "enrollment",
    caseKey: "enrollment:reg-enroll-1:primary",
    reading: "AWAITING_FINANCE",
    owner: "finance",
    primaryPosture: "inspect",
    decisionReady: true,
    allow: ["inspect_evidence", "approve_evidence", "reject_evidence"],
    explainability: {
      headline: "Evidence in review — finance may decide",
      reading: "AWAITING_FINANCE",
      owner: "finance",
      ownerSummary: "Finance owns evidence review",
      primaryPosture: "inspect",
      lane: "daily",
      decisionReady: true,
      auditAltitude: false,
    },
    completeness: {
      completenessClass: "act_complete",
      actReady: true,
      waitComplete: false,
      inspectForced: false,
      escalateForced: false,
      displayToken: "act_complete",
    },
    discoveryAttention: attention ?? null,
  });
}

/** B — Subscription / online payment style subject. */
export function fixtureSubscriptionEncounter(): CaseEncounterViewContract {
  return baseEncounter({
    subjectId: "sub-42",
    subjectKind: "subscription",
    caseKey: "subscription:sub-42:cycle-2026-08",
    reading: "INTENT_OPEN_NO_PROOF",
    owner: "counterparty",
    explainability: {
      headline: "Recurring intent open — awaiting capture signal",
      reading: "INTENT_OPEN_NO_PROOF",
      owner: "counterparty",
      ownerSummary: "Billing counterparty owns the open intent",
      primaryPosture: "wait",
      lane: "daily",
      decisionReady: false,
      auditAltitude: false,
    },
  });
}

/** C — Marketplace buyer payment (isolated caseKey). */
export function fixtureMarketplaceBuyerEncounter(): CaseEncounterViewContract {
  return baseEncounter({
    subjectId: "order-9",
    subjectKind: "buyer_payment",
    caseKey: "marketplace:order-9:buyer",
    reading: "PARTIAL_SCOPED",
    owner: "finance",
    explainability: {
      headline: "Partial buyer capture — scoped remainder",
      reading: "PARTIAL_SCOPED",
      owner: "finance",
      ownerSummary: "Finance may chase only within declared scope",
      primaryPosture: "act",
      lane: "daily",
      decisionReady: false,
      auditAltitude: false,
    },
    completeness: {
      completenessClass: "act_complete",
      actReady: true,
      waitComplete: false,
      inspectForced: false,
      escalateForced: false,
      displayToken: "act_complete",
    },
  });
}
