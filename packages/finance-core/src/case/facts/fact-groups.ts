/**
 * Portable Case fact groups — no product-specific types.
 */

import type { AmountMinorFact, PresenceFact, TriFact } from "./fact-tokens";

export type CaseSubjectKind =
  | "enrollment"
  | "subscription"
  | "buyer_payment"
  | "seller_payout"
  | "dispute"
  | "other";

/** Identity — adapter binds product entities; core sees portable ids only. */
export type IdentityFacts = {
  readonly subjectId: string;
  readonly subjectKind: CaseSubjectKind;
  /** Discriminant when one commercial subject has N money meanings. */
  readonly caseKey: string;
  /** Opaque counterparty id — never a core "member" owner type. */
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
  /** Required for safe partial chase when remaining > 0. */
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

/** Verdict-path facts only — signals live on EncounterMetadata. */
export type CaseFacts = {
  readonly identity: IdentityFacts;
  readonly eligibility: EligibilityFacts;
  readonly money: MoneyFacts;
  readonly intent: IntentFacts;
  readonly evidence: EvidenceFacts;
  readonly settlement: SettlementFacts;
  readonly exceptionCues: ExceptionCueFacts;
  readonly auditCues: AuditCueFacts;
};
