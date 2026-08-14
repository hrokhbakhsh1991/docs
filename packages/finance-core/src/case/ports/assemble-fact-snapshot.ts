/**
 * Merge provider fact groups into CaseFacts + encounter metadata.
 * Does not interpret — no owner/lane/posture/CaseOutput.
 */

import type {
  AuditCueFacts,
  CaseFacts,
  EvidenceFacts,
  IdentityFacts,
  MoneyFacts,
} from "../facts/fact-groups";
import type {
  EncounterAttention,
  EncounterMetadata,
  EncounterMode,
  FactSnapshot,
} from "../snapshot/fact-snapshot";
import type { CaseLifecycleFactBundle } from "./case-lifecycle-fact.port";
import type { CasePaymentFactBundle } from "./case-payment-fact.port";

export type AssembledCaseFactInput = {
  readonly identity: IdentityFacts;
  readonly money: MoneyFacts;
  readonly payment: CasePaymentFactBundle;
  readonly evidence: EvidenceFacts;
  readonly lifecycle: CaseLifecycleFactBundle;
  readonly audit: AuditCueFacts;
  readonly mode: EncounterMode;
  readonly attention: EncounterAttention | null;
};

export function assembleFactSnapshot(input: AssembledCaseFactInput): FactSnapshot {
  const facts: CaseFacts = {
    identity: input.identity,
    eligibility: input.lifecycle.eligibility,
    money: input.money,
    intent: input.payment.intent,
    evidence: input.evidence,
    settlement: input.payment.settlement,
    exceptionCues: {
      closedWithLeftoverArtifacts: input.lifecycle.exceptionCues.closedWithLeftoverArtifacts,
      meaningConflict: input.lifecycle.exceptionCues.meaningConflict,
    },
    auditCues: input.audit,
  };

  const encounter: EncounterMetadata =
    input.attention !== null
      ? { mode: input.mode, attention: input.attention }
      : { mode: input.mode };

  return { facts, encounter };
}
