/**
 * Portable fact fixtures for multi-workspace Case proofs (PR13-C).
 * No Denali / gateway brand types — finance-core vocabulary only.
 */

import {
  absentFact,
  knownFact,
  type CasePaymentFactBundle,
  type CaseLifecycleFactBundle,
  type EvidenceFacts,
  type MoneyFacts,
  type AuditCueFacts,
  type CaseSignalFactBundle,
} from "@app-tour/finance-core/case";

/** Shared money facts used for same-facts portability proof. */
export function portableMoneyDue(): MoneyFacts {
  return {
    obligationPresent: knownFact(true),
    collectionPolicy: knownFact("money_due"),
    amountDue: knownFact("10000"),
    remaining: knownFact("10000"),
    currency: knownFact("IRR"),
    scheduleKind: knownFact("none"),
    partialScopeDeclared: knownFact(false),
  };
}

export function portableManualPaymentOpen(): CasePaymentFactBundle {
  return {
    intent: {
      intentSet: knownFact("one"),
      intentKind: knownFact("manual"),
      intentOpen: knownFact(true),
      provenanceKnown: knownFact(true),
      duplicateOrParallelSuspected: knownFact(false),
    },
    settlement: { settlementMeaning: knownFact("unsettled") },
  };
}

export function portableOnlinePaymentOpen(): CasePaymentFactBundle {
  return {
    intent: {
      intentSet: knownFact("one"),
      intentKind: knownFact("one_shot"),
      intentOpen: knownFact(true),
      provenanceKnown: knownFact(true),
      duplicateOrParallelSuspected: knownFact(false),
    },
    settlement: { settlementMeaning: knownFact("unsettled") },
  };
}

/** Equivalent meaning to portableManualPaymentOpen for cross-workspace same-facts proof. */
export function portableEquivalentAwaitingPayment(): CasePaymentFactBundle {
  return portableManualPaymentOpen();
}

export function portableOfflineEvidenceInReview(): EvidenceFacts {
  return {
    proofExists: knownFact(true),
    proofProgress: knownFact("in_review"),
    evidenceInspectable: knownFact(true),
    evidenceSource: knownFact("offline"),
  };
}

export function portableGatewayEvidencePresent(): EvidenceFacts {
  return {
    proofExists: knownFact(true),
    proofProgress: knownFact("in_review"),
    evidenceInspectable: knownFact(true),
    evidenceSource: knownFact("gateway"),
  };
}

export function portableMissingEvidence(): EvidenceFacts {
  return {
    proofExists: absentFact(),
    proofProgress: knownFact("none"),
    evidenceInspectable: knownFact(false),
    evidenceSource: knownFact("other"),
  };
}

export function portableEligibleLifecycle(): CaseLifecycleFactBundle {
  return {
    eligibility: { lifecycleEligibility: knownFact("eligible") },
    exceptionCues: {
      closedWithLeftoverArtifacts: knownFact(false),
      meaningConflict: knownFact(false),
    },
  };
}

export function portableAuditNone(): AuditCueFacts {
  return {
    ledgerRefsPresent: knownFact(false),
    reconFinding: knownFact("none"),
  };
}

export function portableAuditReconMismatch(): AuditCueFacts {
  return {
    ledgerRefsPresent: knownFact(true),
    reconFinding: knownFact("mismatch"),
  };
}

export function portableReconAttentionSignal(): CaseSignalFactBundle {
  return {
    attention: {
      attentionClass: "reconciliation_attention",
      reasonCode: "AMOUNT_MISMATCH",
    },
  };
}

export function portableNoAttentionSignal(): CaseSignalFactBundle {
  return { attention: null };
}
