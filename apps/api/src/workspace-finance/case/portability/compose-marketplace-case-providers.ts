/**
 * Marketplace buyer-payment workspace simulation (PR13-C).
 * Translates marketplace SoT DTOs → Case read ports.
 * **No Denali imports.** Not a production workspace package.
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
  EvidenceFacts,
  MoneyFacts,
} from "@app-tour/finance-core/case";
import {
  knownFact,
  unknownFact,
  unknownPaymentBundle,
  absentFact,
} from "@app-tour/finance-core/case";

/**
 * Marketplace Host SoT row — may contain gateway ids (stripped at adapter).
 */
export type MarketplacePaymentSoT = {
  readonly buyerOrderId: string;
  readonly gatewayChargeId?: string;
  readonly status: "open" | "processing" | "captured" | "failed" | "unknown";
  readonly amountMinor: string;
  readonly currency: string;
  readonly readFailed?: boolean;
};

export type MarketplaceEvidenceSoT = {
  readonly proofKind: "none" | "gateway_receipt" | "dispute_pack";
  readonly progress: "none" | "in_review" | "accepted" | "rejected";
};

export type MarketplaceLifecycleSoT = {
  readonly orderState: "active" | "cancelled" | "fulfilled";
};

export type MarketplaceReconCue = {
  readonly finding: "none" | "mismatch";
  readonly attentionClass?: string;
  readonly reasonCode?: string;
};

export type MarketplaceCaseReadSource = {
  readonly payment: MarketplacePaymentSoT | null;
  readonly evidence: MarketplaceEvidenceSoT;
  readonly lifecycle: MarketplaceLifecycleSoT;
  readonly recon?: MarketplaceReconCue;
};

function mapPayment(sot: MarketplacePaymentSoT | null): CaseFactProviderResult<CasePaymentFactBundle> {
  if (sot === null) {
    return {
      ok: true,
      value: {
        intent: {
          intentSet: knownFact("none"),
          intentKind: knownFact("one_shot"),
          intentOpen: knownFact(false),
          provenanceKnown: knownFact(true),
          duplicateOrParallelSuspected: knownFact(false),
        },
        settlement: { settlementMeaning: knownFact("idle") },
      },
    };
  }
  if (sot.readFailed === true) {
    return {
      ok: false,
      degraded: true,
      failureReason: "unavailable",
      value: unknownPaymentBundle("marketplace_gateway_unavailable"),
    };
  }

  const open = sot.status === "open" || sot.status === "processing";
  const settlement =
    sot.status === "captured"
      ? knownFact("captured" as const)
      : sot.status === "unknown" || sot.status === "failed"
        ? unknownFact("marketplace_settlement_unread")
        : knownFact("unsettled" as const);

  const value: CasePaymentFactBundle = {
    intent: {
      intentSet: knownFact("one"),
      intentKind: knownFact("one_shot"),
      intentOpen: knownFact(open),
      provenanceKnown: knownFact(true),
      duplicateOrParallelSuspected: knownFact(false),
    },
    settlement: { settlementMeaning: settlement },
  };

  // Prove no gateway leakage in returned facts.
  const blob = JSON.stringify(value);
  if (sot.gatewayChargeId !== undefined && blob.includes(sot.gatewayChargeId)) {
    return {
      ok: false,
      degraded: true,
      failureReason: "unavailable",
      value: unknownPaymentBundle("marketplace_gateway_leak_blocked"),
    };
  }

  return { ok: true, value };
}

function mapEvidence(sot: MarketplaceEvidenceSoT): CaseFactProviderResult<EvidenceFacts> {
  if (sot.proofKind === "none") {
    return {
      ok: true,
      value: {
        proofExists: absentFact(),
        proofProgress: knownFact("none"),
        evidenceInspectable: knownFact(false),
        evidenceSource: knownFact("other"),
      },
    };
  }
  return {
    ok: true,
    value: {
      proofExists: knownFact(true),
      proofProgress: knownFact(sot.progress === "none" ? "in_review" : sot.progress),
      evidenceInspectable: knownFact(true),
      evidenceSource: knownFact(sot.proofKind === "dispute_pack" ? "dispute_pack" : "gateway"),
    },
  };
}

function mapMoney(sot: MarketplacePaymentSoT | null): CaseFactProviderResult<MoneyFacts> {
  if (sot === null) {
    return {
      ok: true,
      value: {
        obligationPresent: absentFact(),
        collectionPolicy: knownFact("no_money_due"),
        amountDue: knownFact("0"),
        remaining: knownFact("0"),
        currency: knownFact("IRR"),
        scheduleKind: knownFact("none"),
        partialScopeDeclared: knownFact(false),
      },
    };
  }
  return {
    ok: true,
    value: {
      obligationPresent: knownFact(true),
      collectionPolicy: knownFact("money_due"),
      amountDue: knownFact(sot.amountMinor),
      remaining: knownFact(sot.amountMinor),
      currency: knownFact(sot.currency),
      scheduleKind: knownFact("none"),
      partialScopeDeclared: knownFact(false),
    },
  };
}

export class MarketplacePaymentCaseFactProvider implements CasePaymentFactPort {
  constructor(private readonly source: MarketplaceCaseReadSource) {}

  async readPaymentFacts(
    _scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CasePaymentFactBundle>> {
    return mapPayment(this.source.payment);
  }
}

export class MarketplaceEvidenceCaseFactProvider implements CaseEvidenceFactPort {
  constructor(private readonly source: MarketplaceCaseReadSource) {}

  async readEvidenceFacts(_scope: CaseFactReadScope): Promise<CaseFactProviderResult<EvidenceFacts>> {
    return mapEvidence(this.source.evidence);
  }
}

export class MarketplaceObligationCaseFactProvider implements CaseObligationFactPort {
  constructor(private readonly source: MarketplaceCaseReadSource) {}

  async readMoneyFacts(_scope: CaseFactReadScope): Promise<CaseFactProviderResult<MoneyFacts>> {
    return mapMoney(this.source.payment);
  }
}

export class MarketplaceLifecycleCaseFactProvider implements CaseLifecycleFactPort {
  constructor(private readonly source: MarketplaceCaseReadSource) {}

  async readLifecycleFacts(
    _scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<{
    eligibility: { lifecycleEligibility: ReturnType<typeof knownFact<"eligible" | "not_eligible">> };
    exceptionCues: {
      closedWithLeftoverArtifacts: ReturnType<typeof knownFact<boolean>>;
      meaningConflict: ReturnType<typeof knownFact<boolean>>;
    };
  }>> {
    const lifecycleEligibility =
      this.source.lifecycle.orderState === "cancelled"
        ? knownFact<"not_eligible">("not_eligible")
        : knownFact<"eligible">("eligible");
    return {
      ok: true as const,
      value: {
        eligibility: { lifecycleEligibility },
        exceptionCues: {
          closedWithLeftoverArtifacts: knownFact(false),
          meaningConflict: knownFact(false),
        },
      },
    };
  }
}

export class MarketplaceLedgerCaseFactProvider implements CaseLedgerFactPort {
  constructor(private readonly source: MarketplaceCaseReadSource) {}

  async readAuditCues(_scope: CaseFactReadScope) {
    const finding = this.source.recon?.finding ?? "none";
    return {
      ok: true as const,
      value: {
        ledgerRefsPresent: knownFact(finding === "mismatch"),
        reconFinding: knownFact(finding),
      },
    };
  }
}

export class MarketplaceSignalCaseFactProvider implements CaseSignalFactPort {
  constructor(private readonly source: MarketplaceCaseReadSource) {}

  async readAttention(_scope: CaseFactReadScope) {
    const recon = this.source.recon;
    if (recon === undefined || recon.finding === "none" || recon.attentionClass === undefined) {
      return { ok: true as const, value: { attention: null } };
    }
    return {
      ok: true as const,
      value: {
        attention: {
          attentionClass: recon.attentionClass,
          ...(recon.reasonCode !== undefined ? { reasonCode: recon.reasonCode } : {}),
        },
      },
    };
  }
}

/**
 * Compose marketplace simulation providers — no Denali modules.
 */
export function composeMarketplaceCaseFactProviders(
  source: MarketplaceCaseReadSource
): CaseFactAssemblerProviders {
  return {
    obligation: new MarketplaceObligationCaseFactProvider(source),
    payment: new MarketplacePaymentCaseFactProvider(source),
    evidence: new MarketplaceEvidenceCaseFactProvider(source),
    lifecycle: new MarketplaceLifecycleCaseFactProvider(source),
    ledger: new MarketplaceLedgerCaseFactProvider(source),
    signal: new MarketplaceSignalCaseFactProvider(source),
  };
}
