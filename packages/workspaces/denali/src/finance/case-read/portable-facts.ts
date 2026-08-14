/**
 * Portable Case fact groups — structural mirror of finance-core Case facts.
 * Opaque string ids only; no Denali registration/member/tour domain types.
 */

import type { AmountMinorFact, PresenceFact, TriFact } from "./fact-tokens";

export type CaseSubjectKind =
  | "enrollment"
  | "subscription"
  | "buyer_payment"
  | "seller_payout"
  | "dispute"
  | "other";

export type IdentityFacts = {
  readonly subjectId: string;
  readonly subjectKind: CaseSubjectKind;
  readonly caseKey: string;
  readonly counterpartyId: string;
};

export type LifecycleEligibility = "eligible" | "not_eligible" | "closed";

export type EligibilityFacts = {
  readonly lifecycleEligibility: TriFact<LifecycleEligibility>;
};

export type CollectionPolicy = "money_due" | "no_money_due" | "deferred";

export type ScheduleKind = "none" | "installments" | "cycle" | "other";

export type MoneyFacts = {
  readonly obligationPresent: PresenceFact;
  readonly collectionPolicy: TriFact<CollectionPolicy>;
  readonly amountDue: AmountMinorFact;
  readonly remaining: AmountMinorFact;
  readonly currency: TriFact<string>;
  readonly scheduleKind: TriFact<ScheduleKind>;
  readonly partialScopeDeclared: TriFact<boolean>;
};

export type IntentKind = "one_shot" | "recurring" | "manual" | "other";

export type IntentSet = "none" | "one" | "many";

export type IntentFacts = {
  readonly intentSet: TriFact<IntentSet>;
  readonly intentKind: TriFact<IntentKind>;
  readonly intentOpen: TriFact<boolean>;
  readonly provenanceKnown: TriFact<boolean>;
  readonly duplicateOrParallelSuspected: TriFact<boolean>;
};

export type ProofProgress = "none" | "in_review" | "accepted" | "rejected";

export type EvidenceSource = "offline" | "gateway" | "dispute_pack" | "other";

export type EvidenceFacts = {
  readonly proofExists: PresenceFact;
  readonly proofProgress: TriFact<ProofProgress>;
  readonly evidenceInspectable: TriFact<boolean>;
  readonly evidenceSource: TriFact<EvidenceSource>;
};

export type SettlementMeaning = "unsettled" | "captured" | "refunded" | "disputed" | "idle";

export type SettlementFacts = {
  readonly settlementMeaning: TriFact<SettlementMeaning>;
};

export type ExceptionCueFacts = {
  readonly closedWithLeftoverArtifacts: TriFact<boolean>;
  readonly meaningConflict: TriFact<boolean>;
};

export type ReconFinding = "none" | "mismatch";

export type AuditCueFacts = {
  readonly ledgerRefsPresent: TriFact<boolean>;
  readonly reconFinding: TriFact<ReconFinding>;
};

export type EncounterAttention = {
  readonly attentionClass: string;
  readonly reasonCode?: string;
};

export type CasePaymentFactBundle = {
  readonly intent: IntentFacts;
  readonly settlement: SettlementFacts;
};

export type CaseLifecycleFactBundle = {
  readonly eligibility: EligibilityFacts;
  readonly exceptionCues: Pick<
    ExceptionCueFacts,
    "closedWithLeftoverArtifacts" | "meaningConflict"
  >;
};

export type CaseSignalFactBundle = {
  readonly attention: EncounterAttention | null;
};

export type CaseFactProviderFailureReason =
  | "unavailable"
  | "forbidden"
  | "unsupported"
  | "not_found";

export type CaseFactProviderResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly degraded?: false;
    }
  | {
      readonly ok: false;
      readonly failureReason: CaseFactProviderFailureReason;
      readonly value: T;
      readonly degraded: true;
    };

export type CaseFactReadScope = {
  readonly caseKey: string;
  readonly subjectId: string;
  readonly subjectKind: CaseSubjectKind;
  readonly counterpartyId: string;
};
