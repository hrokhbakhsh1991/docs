/**
 * Fully-unknown fact groups for degraded / missing reads.
 * Never uses zero or absent as a stand-in for unknown.
 */

import type {
  AuditCueFacts,
  EligibilityFacts,
  EvidenceFacts,
  ExceptionCueFacts,
  IntentFacts,
  MoneyFacts,
  SettlementFacts,
} from "../facts/fact-groups";
import { unknownFact } from "../facts/fact-tokens";
import type { CaseLifecycleFactBundle } from "./case-lifecycle-fact.port";
import type { CasePaymentFactBundle } from "./case-payment-fact.port";
import type { CaseSignalFactBundle } from "./case-signal-fact.port";

export function unknownMoneyFacts(reason: string): MoneyFacts {
  return {
    obligationPresent: unknownFact(reason),
    collectionPolicy: unknownFact(reason),
    amountDue: unknownFact(reason),
    remaining: unknownFact(reason),
    currency: unknownFact(reason),
    scheduleKind: unknownFact(reason),
    partialScopeDeclared: unknownFact(reason),
  };
}

export function unknownIntentFacts(reason: string): IntentFacts {
  return {
    intentSet: unknownFact(reason),
    intentKind: unknownFact(reason),
    intentOpen: unknownFact(reason),
    provenanceKnown: unknownFact(reason),
    duplicateOrParallelSuspected: unknownFact(reason),
  };
}

export function unknownSettlementFacts(reason: string): SettlementFacts {
  return {
    settlementMeaning: unknownFact(reason),
  };
}

export function unknownPaymentBundle(reason: string): CasePaymentFactBundle {
  return {
    intent: unknownIntentFacts(reason),
    settlement: unknownSettlementFacts(reason),
  };
}

export function unknownEvidenceFacts(reason: string): EvidenceFacts {
  return {
    proofExists: unknownFact(reason),
    proofProgress: unknownFact(reason),
    evidenceInspectable: unknownFact(reason),
    evidenceSource: unknownFact(reason),
  };
}

export function unknownEligibilityFacts(reason: string): EligibilityFacts {
  return {
    lifecycleEligibility: unknownFact(reason),
  };
}

export function unknownExceptionCues(reason: string): ExceptionCueFacts {
  return {
    closedWithLeftoverArtifacts: unknownFact(reason),
    meaningConflict: unknownFact(reason),
  };
}

export function unknownLifecycleBundle(reason: string): CaseLifecycleFactBundle {
  return {
    eligibility: unknownEligibilityFacts(reason),
    exceptionCues: unknownExceptionCues(reason),
  };
}

export function unknownAuditCues(reason: string): AuditCueFacts {
  return {
    ledgerRefsPresent: unknownFact(reason),
    reconFinding: unknownFact(reason),
  };
}

export function unknownSignalBundle(): CaseSignalFactBundle {
  return { attention: null };
}
