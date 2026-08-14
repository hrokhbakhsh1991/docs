/**
 * Presentation contract for Case EncounterView (PR8-B).
 * Structurally compatible with `@app-tour/finance-core/case` CaseEncounterView.
 * UI packages must not import CaseOutput or FactSnapshot types from finance-core.
 */

import type { CaseCommandCapabilityContract } from "./command-capability";

export type CaseSubjectKindContract =
  | "enrollment"
  | "subscription"
  | "buyer_payment"
  | "seller_payout"
  | "dispute"
  | "other";

export type CaseReadingContract =
  | "AWAITING_COUNTERPARTY"
  | "AWAITING_FINANCE"
  | "NO_MONEY_DUE"
  | "NOT_ELIGIBLE"
  | "INTENT_OPEN_NO_PROOF"
  | "PARTIAL_SCOPED"
  | "SETTLED_CAPTURED"
  | "CLOSED_IDLE"
  | "EXCEPTION"
  | "INCOMPLETE_INSPECT";

export type CaseOwnerContract =
  | "finance"
  | "counterparty"
  | "product_desk"
  | "policy_system"
  | "exception_policy"
  | "audit"
  | "idle";

export type CaseLaneContract = "daily" | "exception" | "audit";

export type CasePostureContract = "act" | "wait" | "inspect" | "escalate";

export type CompletenessClassContract =
  | "act_complete"
  | "wait_complete"
  | "inspect_forced"
  | "escalate_forced";

export type ConfidencePresentationContract = {
  readonly whyVisible: string;
  readonly whyMineOrNot: string;
  readonly ifIWait: string;
  readonly avoid: string;
};

export type EncounterExplainabilityContract = {
  readonly headline: string;
  readonly reading: CaseReadingContract;
  readonly owner: CaseOwnerContract;
  readonly ownerSummary: string;
  readonly primaryPosture: CasePostureContract;
  readonly lane: CaseLaneContract;
  readonly decisionReady: boolean;
  readonly auditAltitude: boolean;
};

export type EncounterCompletenessContract = {
  readonly completenessClass: CompletenessClassContract;
  readonly actReady: boolean;
  readonly waitComplete: boolean;
  readonly inspectForced: boolean;
  readonly escalateForced: boolean;
  readonly displayToken: CompletenessClassContract;
};

export type DiscoveryAttentionContract = {
  readonly attentionClass: string;
  readonly reasonCode?: string;
};

/**
 * Only presentation input for the read-only operator shell.
 */
export type CaseEncounterViewContract = {
  readonly subjectId: string;
  readonly subjectKind: CaseSubjectKindContract;
  readonly caseKey: string;
  readonly reading: CaseReadingContract;
  readonly owner: CaseOwnerContract;
  readonly lane: CaseLaneContract;
  readonly primaryPosture: CasePostureContract;
  readonly decisionReady: boolean;
  readonly allow: readonly string[];
  readonly forbid: readonly string[];
  readonly auditAltitude: boolean;
  readonly explainability: EncounterExplainabilityContract;
  readonly confidence: ConfidencePresentationContract;
  readonly completeness: EncounterCompletenessContract;
  readonly discoveryAttention: DiscoveryAttentionContract | null;
};

/**
 * Operator presentation chrome (PR13-A).
 * Display-only — not a Case verdict / ownership signal.
 */
export type EncounterSurfaceStateContract =
  | "loading"
  | "unavailable"
  | "degraded"
  | "incomplete"
  | "normal";

/** Successful Host load envelope — presentation + surface chrome. */
export type CaseEncounterPresentationEnvelope = {
  readonly encounter: CaseEncounterViewContract;
  readonly surfaceState: Exclude<EncounterSurfaceStateContract, "loading" | "unavailable">;
  /** Opaque Host execution id — changes on every successful load/refresh. */
  readonly executionId?: string;
  /** PR14-B — optional Host meaning fingerprint for stale intent. */
  readonly meaningFingerprint?: string;
  /** PR14-B — command capability metadata (no UI buttons in this phase). */
  readonly commandCapability?: CaseCommandCapabilityContract;
};
