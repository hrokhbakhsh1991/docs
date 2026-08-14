/**
 * Default English presentation labels — localization keys only, not financial rules.
 */

import type {
  CaseLaneContract,
  CaseOwnerContract,
  CasePostureContract,
  CaseReadingContract,
  CaseSubjectKindContract,
  CompletenessClassContract,
} from "./contract";

export type CaseEncounterLabelBundle = {
  readonly sections: {
    readonly identity: string;
    readonly explanation: string;
    readonly ownership: string;
    readonly confidence: string;
    readonly completeness: string;
    readonly attention: string;
    readonly vocabularyHints: string;
    readonly commandCapability?: string;
  };
  readonly fields: {
    readonly caseKey: string;
    readonly subjectKind: string;
    readonly subjectId: string;
    readonly counterparty: string;
    readonly reading: string;
    readonly headline: string;
    readonly owner: string;
    readonly ownerSummary: string;
    readonly lane: string;
    readonly posture: string;
    readonly decisionReady: string;
    readonly whyVisible: string;
    readonly whyMineOrNot: string;
    readonly ifIWait: string;
    readonly avoid: string;
    readonly completenessClass: string;
    readonly allow: string;
    readonly forbid: string;
    readonly refresh: string;
    readonly loading: string;
    readonly loadError: string;
    readonly noAttention: string;
    readonly supportedCommands?: string;
    readonly availableTokens?: string;
    readonly capabilityEndpoint?: string;
    readonly noAvailableTokens?: string;
    readonly capabilityReadOnlyNote?: string;
    readonly executionId?: string;
  };
  /** PR13-A — operator surface chrome labels (display only). */
  readonly surfaceStates?: Partial<
    Record<"loading" | "unavailable" | "degraded" | "incomplete" | "normal", string>
  >;
  /** Optional presentation map for discovery attentionClass (not financial rules). */
  readonly attentionClass?: Readonly<Record<string, string>>;
  readonly reading: Record<CaseReadingContract, string>;
  readonly owner: Record<CaseOwnerContract, string>;
  readonly lane: Record<CaseLaneContract, string>;
  readonly posture: Record<CasePostureContract, string>;
  readonly subjectKind: Record<CaseSubjectKindContract, string>;
  readonly completeness: Record<CompletenessClassContract, string>;
};

export const DEFAULT_CASE_ENCOUNTER_LABELS: CaseEncounterLabelBundle = {
  sections: {
    identity: "Identity",
    explanation: "Explanation",
    ownership: "Ownership",
    confidence: "Confidence",
    completeness: "Completeness",
    attention: "Attention",
    vocabularyHints: "Action vocabulary (display only)",
    commandCapability: "Command capability (read-only)",
  },
  fields: {
    caseKey: "Case key",
    subjectKind: "Subject kind",
    subjectId: "Subject id",
    counterparty: "Counterparty",
    reading: "Reading",
    headline: "Headline",
    owner: "Owner",
    ownerSummary: "Owner summary",
    lane: "Lane",
    posture: "Posture",
    decisionReady: "Decision ready",
    whyVisible: "Why visible",
    whyMineOrNot: "Why mine or not",
    ifIWait: "If I wait",
    avoid: "Avoid",
    completenessClass: "Completeness class",
    allow: "Allow hints",
    forbid: "Forbid hints",
    refresh: "Refresh",
    loading: "Loading encounter…",
    loadError: "Could not load encounter",
    noAttention: "No attention signal for this encounter",
    supportedCommands: "Supported commands",
    availableTokens: "Available tokens (display only)",
    capabilityEndpoint: "Bridge endpoint (metadata)",
    noAvailableTokens: "None available for this reading",
    capabilityReadOnlyNote:
      "Read-only metadata — no approve/reject controls on this surface.",
    executionId: "Execution",
  },
  surfaceStates: {
    loading: "Loading encounter…",
    unavailable: "Encounter unavailable",
    degraded: "Encounter available with degraded facts",
    incomplete: "Encounter incomplete — inspect coverage",
    normal: "Encounter ready",
  },
  attentionClass: {
    reconciliation_attention:
      "Attention required: payment evidence differs from recorded settlement",
  },
  reading: {
    AWAITING_COUNTERPARTY: "Awaiting counterparty",
    AWAITING_FINANCE: "Awaiting finance",
    NO_MONEY_DUE: "No money due",
    NOT_ELIGIBLE: "Not eligible",
    INTENT_OPEN_NO_PROOF: "Intent open — no proof",
    PARTIAL_SCOPED: "Partial — scoped",
    SETTLED_CAPTURED: "Settled — captured",
    CLOSED_IDLE: "Closed — idle",
    EXCEPTION: "Exception",
    INCOMPLETE_INSPECT: "Incomplete — inspect",
  },
  owner: {
    finance: "Finance",
    counterparty: "Counterparty",
    product_desk: "Product desk",
    policy_system: "Policy system",
    exception_policy: "Exception policy",
    audit: "Audit",
    idle: "Idle",
  },
  lane: {
    daily: "Daily",
    exception: "Exception",
    audit: "Audit",
  },
  posture: {
    act: "Act",
    wait: "Wait",
    inspect: "Inspect",
    escalate: "Escalate",
  },
  subjectKind: {
    enrollment: "Enrollment",
    subscription: "Subscription",
    buyer_payment: "Buyer payment",
    seller_payout: "Seller payout",
    dispute: "Dispute",
    other: "Other",
  },
  completeness: {
    act_complete: "Act complete",
    wait_complete: "Wait complete",
    inspect_forced: "Inspect forced",
    escalate_forced: "Escalate forced",
  },
};
