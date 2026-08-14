/**
 * Static Case providers — inject identical portable facts for portability proofs (PR13-C).
 * Workspace label is documentation only; finance-core never sees it.
 */

import type {
  CaseEvidenceFactPort,
  CaseFactAssemblerProviders,
  CaseFactProviderResult,
  CaseFactReadScope,
  CaseLedgerFactPort,
  CaseLifecycleFactPort,
  CaseObligationFactPort,
  CasePaymentFactBundle,
  CasePaymentFactPort,
  CaseSignalFactPort,
  CaseLifecycleFactBundle,
  EvidenceFacts,
  MoneyFacts,
  AuditCueFacts,
  CaseSignalFactBundle,
} from "@app-tour/finance-core/case";

export type StaticPortableFactSet = {
  readonly money: MoneyFacts;
  readonly payment: CasePaymentFactBundle;
  readonly evidence: EvidenceFacts;
  readonly lifecycle: CaseLifecycleFactBundle;
  readonly audit?: AuditCueFacts;
  readonly signal?: CaseSignalFactBundle;
};

function ok<T>(value: T): CaseFactProviderResult<T> {
  return { ok: true, value };
}

/**
 * Build CaseFactAssemblerProviders from already-portable facts.
 * Two workspaces can wrap the same fact set with different composer names —
 * interpreter output must match.
 */
export function composeStaticPortableCaseProviders(
  facts: StaticPortableFactSet
): CaseFactAssemblerProviders {
  const obligation: CaseObligationFactPort = {
    async readMoneyFacts(_scope: CaseFactReadScope) {
      return ok(facts.money);
    },
  };
  const payment: CasePaymentFactPort = {
    async readPaymentFacts(_scope: CaseFactReadScope) {
      return ok(facts.payment);
    },
  };
  const evidence: CaseEvidenceFactPort = {
    async readEvidenceFacts(_scope: CaseFactReadScope) {
      return ok(facts.evidence);
    },
  };
  const lifecycle: CaseLifecycleFactPort = {
    async readLifecycleFacts(_scope: CaseFactReadScope) {
      return ok(facts.lifecycle);
    },
  };
  const ledger: CaseLedgerFactPort | undefined =
    facts.audit === undefined
      ? undefined
      : {
          async readAuditCues(_scope: CaseFactReadScope) {
            return ok(facts.audit!);
          },
        };
  const signal: CaseSignalFactPort | undefined =
    facts.signal === undefined
      ? undefined
      : {
          async readAttention(_scope: CaseFactReadScope) {
            return ok(facts.signal!);
          },
        };

  return {
    obligation,
    payment,
    evidence,
    lifecycle,
    ...(ledger !== undefined ? { ledger } : {}),
    ...(signal !== undefined ? { signal } : {}),
  };
}
