/**
 * In-memory Case fact providers for contract tests.
 * Deterministic · unknown simulation · degraded · conflicting cues.
 * Never returns CaseOutput / owner / posture.
 */

import type { AuditCueFacts, EvidenceFacts, MoneyFacts } from "../../../src/case/facts/fact-groups.ts";
import { absentFact, knownFact } from "../../../src/case/facts/fact-tokens.ts";
import type { CaseEvidenceFactPort } from "../../../src/case/ports/case-evidence-fact.port.ts";
import type {
  CaseFactProviderResult,
  CaseFactReadScope,
} from "../../../src/case/ports/case-fact-read-scope.ts";
import type { CaseLedgerFactPort } from "../../../src/case/ports/case-ledger-fact.port.ts";
import type {
  CaseLifecycleFactBundle,
  CaseLifecycleFactPort,
} from "../../../src/case/ports/case-lifecycle-fact.port.ts";
import type { CaseObligationFactPort } from "../../../src/case/ports/case-obligation-fact.port.ts";
import type {
  CasePaymentFactBundle,
  CasePaymentFactPort,
} from "../../../src/case/ports/case-payment-fact.port.ts";
import type {
  CaseSignalFactBundle,
  CaseSignalFactPort,
} from "../../../src/case/ports/case-signal-fact.port.ts";
import {
  unknownAuditCues,
  unknownEvidenceFacts,
  unknownLifecycleBundle,
  unknownMoneyFacts,
  unknownPaymentBundle,
  unknownSignalBundle,
} from "../../../src/case/ports/unknown-fact-groups.ts";
import type { EncounterAttention } from "../../../src/case/snapshot/fact-snapshot.ts";

export type FakeCaseProviderStore = {
  money?: MoneyFacts;
  payment?: CasePaymentFactBundle;
  evidence?: EvidenceFacts;
  lifecycle?: CaseLifecycleFactBundle;
  audit?: AuditCueFacts;
  attention?: EncounterAttention | null;
  /** Force degraded unknown responses for listed ports. */
  degrade?: Partial<
    Record<
      "obligation" | "payment" | "evidence" | "lifecycle" | "ledger" | "signal",
      true
    >
  >;
  /** Simulate missing seed → unknown (not zero). */
  missing?: Partial<
    Record<
      "obligation" | "payment" | "evidence" | "lifecycle" | "ledger" | "signal",
      true
    >
  >;
};

function ok<T>(value: T): CaseFactProviderResult<T> {
  return { ok: true, value };
}

function degraded<T>(value: T, reason: "unavailable" | "forbidden" = "unavailable"): CaseFactProviderResult<T> {
  return { ok: false, degraded: true, failureReason: reason, value };
}

export class FakeCaseObligationFactProvider implements CaseObligationFactPort {
  constructor(private readonly byKey: Map<string, FakeCaseProviderStore>) {}

  async readMoneyFacts(scope: CaseFactReadScope): Promise<CaseFactProviderResult<MoneyFacts>> {
    const row = this.byKey.get(scope.caseKey);
    if (row?.degrade?.obligation) {
      return degraded(unknownMoneyFacts("unavailable"), "unavailable");
    }
    if (!row || row.missing?.obligation || row.money === undefined) {
      return ok(unknownMoneyFacts("missing"));
    }
    return ok(row.money);
  }
}

export class FakeCasePaymentFactProvider implements CasePaymentFactPort {
  constructor(private readonly byKey: Map<string, FakeCaseProviderStore>) {}

  async readPaymentFacts(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CasePaymentFactBundle>> {
    const row = this.byKey.get(scope.caseKey);
    if (row?.degrade?.payment) {
      return degraded(unknownPaymentBundle("unavailable"), "unavailable");
    }
    if (!row || row.missing?.payment || row.payment === undefined) {
      return ok(unknownPaymentBundle("missing"));
    }
    return ok(row.payment);
  }
}

export class FakeCaseEvidenceFactProvider implements CaseEvidenceFactPort {
  constructor(private readonly byKey: Map<string, FakeCaseProviderStore>) {}

  async readEvidenceFacts(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<EvidenceFacts>> {
    const row = this.byKey.get(scope.caseKey);
    if (row?.degrade?.evidence) {
      return degraded(unknownEvidenceFacts("unavailable"), "unavailable");
    }
    if (!row || row.missing?.evidence || row.evidence === undefined) {
      return ok(unknownEvidenceFacts("missing"));
    }
    return ok(row.evidence);
  }
}

export class FakeCaseLifecycleFactProvider implements CaseLifecycleFactPort {
  constructor(private readonly byKey: Map<string, FakeCaseProviderStore>) {}

  async readLifecycleFacts(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CaseLifecycleFactBundle>> {
    const row = this.byKey.get(scope.caseKey);
    if (row?.degrade?.lifecycle) {
      return degraded(unknownLifecycleBundle("unavailable"), "unavailable");
    }
    if (!row || row.missing?.lifecycle || row.lifecycle === undefined) {
      return ok(unknownLifecycleBundle("missing"));
    }
    return ok(row.lifecycle);
  }
}

export class FakeCaseLedgerFactProvider implements CaseLedgerFactPort {
  constructor(private readonly byKey: Map<string, FakeCaseProviderStore>) {}

  async readAuditCues(scope: CaseFactReadScope): Promise<CaseFactProviderResult<AuditCueFacts>> {
    const row = this.byKey.get(scope.caseKey);
    if (row?.degrade?.ledger) {
      return degraded(unknownAuditCues("unavailable"), "unavailable");
    }
    if (!row || row.missing?.ledger || row.audit === undefined) {
      return ok(unknownAuditCues("missing"));
    }
    return ok(row.audit);
  }
}

export class FakeCaseSignalFactProvider implements CaseSignalFactPort {
  constructor(private readonly byKey: Map<string, FakeCaseProviderStore>) {}

  async readAttention(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CaseSignalFactBundle>> {
    const row = this.byKey.get(scope.caseKey);
    if (row?.degrade?.signal) {
      return degraded(unknownSignalBundle(), "unavailable");
    }
    if (!row || row.missing?.signal) {
      return ok(unknownSignalBundle());
    }
    return ok({ attention: row.attention ?? null });
  }
}

export type FakeCaseFactProviderBundle = {
  readonly store: Map<string, FakeCaseProviderStore>;
  readonly obligation: FakeCaseObligationFactProvider;
  readonly payment: FakeCasePaymentFactProvider;
  readonly evidence: FakeCaseEvidenceFactProvider;
  readonly lifecycle: FakeCaseLifecycleFactProvider;
  readonly ledger: FakeCaseLedgerFactProvider;
  readonly signal: FakeCaseSignalFactProvider;
};

export function createFakeCaseFactProviders(
  seed: ReadonlyMap<string, FakeCaseProviderStore> | Record<string, FakeCaseProviderStore> = {}
): FakeCaseFactProviderBundle {
  const store =
    seed instanceof Map ? new Map(seed) : new Map(Object.entries(seed));
  return {
    store,
    obligation: new FakeCaseObligationFactProvider(store),
    payment: new FakeCasePaymentFactProvider(store),
    evidence: new FakeCaseEvidenceFactProvider(store),
    lifecycle: new FakeCaseLifecycleFactProvider(store),
    ledger: new FakeCaseLedgerFactProvider(store),
    signal: new FakeCaseSignalFactProvider(store),
  };
}

/** Seed helper — calm money-due / no proof baseline. */
export function seedAwaitingCounterpartyFacts(): FakeCaseProviderStore {
  return {
    money: {
      obligationPresent: knownFact(true),
      collectionPolicy: knownFact("money_due"),
      amountDue: knownFact("10000"),
      remaining: knownFact("10000"),
      currency: knownFact("IRR"),
      scheduleKind: knownFact("none"),
      partialScopeDeclared: knownFact(false),
    },
    payment: {
      intent: {
        intentSet: knownFact("none"),
        intentKind: knownFact("other"),
        intentOpen: knownFact(false),
        provenanceKnown: knownFact(true),
        duplicateOrParallelSuspected: knownFact(false),
      },
      settlement: { settlementMeaning: knownFact("unsettled") },
    },
    evidence: {
      proofExists: absentFact(),
      proofProgress: knownFact("none"),
      evidenceInspectable: knownFact(false),
      evidenceSource: knownFact("other"),
    },
    lifecycle: {
      eligibility: { lifecycleEligibility: knownFact("eligible") },
      exceptionCues: {
        closedWithLeftoverArtifacts: knownFact(false),
        meaningConflict: knownFact(false),
      },
    },
    audit: {
      ledgerRefsPresent: knownFact(false),
      reconFinding: knownFact("none"),
    },
    attention: { attentionClass: "unsettled_obligation" },
  };
}
