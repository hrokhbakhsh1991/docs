/**
 * Apply Host recon cues onto existing Case *read* providers (PR11-B).
 * Observation only — no SoT mutation, no Case persistence.
 */

import type {
  AuditCueFacts,
  CaseFactProviderResult,
  CaseFactReadScope,
  CaseLedgerFactPort,
  CaseLifecycleFactPort,
  CasePaymentFactBundle,
  CasePaymentFactPort,
  CaseSignalFactBundle,
  CaseSignalFactPort,
} from "@app-tour/finance-core/case";
import { knownFact } from "@app-tour/finance-core/case";

import { allFindingCodes, hasCueKind } from "./emit-portable-recon-cues";
import type { HostReconciliationSession } from "./host-reconciliation-session";

function attentionFromClassification(codes: readonly string[]): CaseSignalFactBundle {
  return {
    attention: {
      attentionClass: "reconciliation_attention",
      reasonCode: codes.join(","),
    },
  };
}

export class ReconAugmentedLedgerFactProvider implements CaseLedgerFactPort {
  constructor(
    private readonly inner: CaseLedgerFactPort,
    private readonly session: HostReconciliationSession
  ) {}

  async readAuditCues(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<AuditCueFacts>> {
    const [inner, classification] = await Promise.all([
      this.inner.readAuditCues(scope),
      this.session.classifyForScope(scope),
    ]);
    if (!hasCueKind(classification.cues, "reconciliationConflict")) {
      return inner;
    }
    return {
      ...inner,
      value: {
        ledgerRefsPresent: inner.value.ledgerRefsPresent,
        reconFinding: knownFact("mismatch"),
      },
    };
  }
}

export class ReconAugmentedSignalFactProvider implements CaseSignalFactPort {
  constructor(
    private readonly inner: CaseSignalFactPort | null,
    private readonly session: HostReconciliationSession
  ) {}

  async readAttention(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CaseSignalFactBundle>> {
    const classification = await this.session.classifyForScope(scope);
    const wantsAttention = hasCueKind(classification.cues, "reconciliationAttention");
    const codes = allFindingCodes(classification.cues);

    if (this.inner === null) {
      if (!wantsAttention) {
        return { ok: true, value: { attention: null } };
      }
      return { ok: true, value: attentionFromClassification(codes) };
    }

    const inner = await this.inner.readAttention(scope);
    if (!wantsAttention) return inner;
    // Prefer recon discovery attention; do not invent ownership language.
    return { ok: true, value: attentionFromClassification(codes) };
  }
}

export class ReconAugmentedLifecycleFactProvider implements CaseLifecycleFactPort {
  constructor(
    private readonly inner: CaseLifecycleFactPort,
    private readonly session: HostReconciliationSession
  ) {}

  async readLifecycleFacts(scope: CaseFactReadScope) {
    const [inner, classification] = await Promise.all([
      this.inner.readLifecycleFacts(scope),
      this.session.classifyForScope(scope),
    ]);
    const amountMismatch = classification.findings.includes("AMOUNT_MISMATCH");
    if (!amountMismatch) return inner;
    return {
      ...inner,
      value: {
        eligibility: inner.value.eligibility,
        exceptionCues: {
          closedWithLeftoverArtifacts: inner.value.exceptionCues.closedWithLeftoverArtifacts,
          meaningConflict: knownFact(true),
        },
      },
    };
  }
}

export class ReconAugmentedPaymentFactProvider implements CasePaymentFactPort {
  constructor(
    private readonly inner: CasePaymentFactPort,
    private readonly session: HostReconciliationSession
  ) {}

  async readPaymentFacts(
    scope: CaseFactReadScope
  ): Promise<CaseFactProviderResult<CasePaymentFactBundle>> {
    const [inner, classification] = await Promise.all([
      this.inner.readPaymentFacts(scope),
      this.session.classifyForScope(scope),
    ]);

    let value = inner.value;

    if (classification.findings.includes("DUPLICATE_PAYMENT_EVIDENCE")) {
      value = {
        intent: {
          ...value.intent,
          duplicateOrParallelSuspected: knownFact(true),
        },
        settlement: value.settlement,
      };
    }

    // PROVIDER_DEGRADED / SOT_PAID_GW_UNKNOWN: do not invent unpaid/failure.
    // Preserve inner settlement/intent; unknown cues stay on the cue channel.
    // If inner already degraded, leave as-is (unknown remains unknown).
    return { ...inner, value };
  }
}
