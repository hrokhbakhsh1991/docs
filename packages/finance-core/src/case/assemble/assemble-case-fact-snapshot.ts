/**
 * Host-owned FactSnapshot orchestration.
 *
 * Temporary residence under finance-core/src/case/assemble until Case is
 * exported for apps/api. Coordinates providers only — no verdict selection.
 */

import { assembleFactSnapshot } from "../ports/assemble-fact-snapshot";
import type { CaseEvidenceFactPort } from "../ports/case-evidence-fact.port";
import type {
  CaseFactProviderFailureReason,
  CaseFactProviderResult,
  CaseFactReadScope,
} from "../ports/case-fact-read-scope";
import type { CaseLedgerFactPort } from "../ports/case-ledger-fact.port";
import type { CaseLifecycleFactPort } from "../ports/case-lifecycle-fact.port";
import type { CaseObligationFactPort } from "../ports/case-obligation-fact.port";
import type { CasePaymentFactPort } from "../ports/case-payment-fact.port";
import type { CaseSignalFactPort } from "../ports/case-signal-fact.port";
import {
  unknownAuditCues,
  unknownEvidenceFacts,
  unknownLifecycleBundle,
  unknownMoneyFacts,
  unknownPaymentBundle,
  unknownSignalBundle,
} from "../ports/unknown-fact-groups";
import type { EncounterMode, FactSnapshot } from "../snapshot/fact-snapshot";

export type CaseFactAssemblerProviders = {
  readonly obligation: CaseObligationFactPort;
  readonly payment: CasePaymentFactPort;
  readonly evidence: CaseEvidenceFactPort;
  readonly lifecycle: CaseLifecycleFactPort;
  /** Optional — omitted or skipped → unknown audit cues (not zero). */
  readonly ledger?: CaseLedgerFactPort;
  /** Optional — omitted or skipped → attention null on encounter. */
  readonly signal?: CaseSignalFactPort;
};

export type AssembleCaseFactSnapshotRequest = {
  readonly scope: CaseFactReadScope;
  readonly mode: EncounterMode;
  /** Default true when ledger provider is present. */
  readonly includeLedger?: boolean;
  /** Default true when signal provider is present. */
  readonly includeSignal?: boolean;
  /** Per-provider timeout; exceeded → degraded unknown facts. */
  readonly providerTimeoutMs?: number;
};

export type ProviderInvocationStatus = {
  readonly invoked: boolean;
  readonly ok: boolean;
  readonly degraded: boolean;
  readonly failureReason?: CaseFactProviderFailureReason | "timeout";
};

export type AssembleCaseFactSnapshotResult = {
  readonly snapshot: FactSnapshot;
  readonly providers: {
    readonly obligation: ProviderInvocationStatus;
    readonly payment: ProviderInvocationStatus;
    readonly evidence: ProviderInvocationStatus;
    readonly lifecycle: ProviderInvocationStatus;
    readonly ledger: ProviderInvocationStatus;
    readonly signal: ProviderInvocationStatus;
  };
};

function statusFromResult<T>(
  invoked: boolean,
  result: CaseFactProviderResult<T> | null,
  timedOut: boolean
): ProviderInvocationStatus {
  if (!invoked) {
    return { invoked: false, ok: true, degraded: false };
  }
  if (timedOut) {
    return { invoked: true, ok: false, degraded: true, failureReason: "timeout" };
  }
  if (result === null) {
    return { invoked: true, ok: false, degraded: true, failureReason: "unavailable" };
  }
  if (result.ok) {
    return { invoked: true, ok: true, degraded: false };
  }
  return {
    invoked: true,
    ok: false,
    degraded: true,
    failureReason: result.failureReason,
  };
}

async function invokeProvider<T>(
  promise: Promise<CaseFactProviderResult<T>>,
  timeoutMs: number | undefined,
  unknownFactory: (reason: string) => T
): Promise<{ result: CaseFactProviderResult<T>; timedOut: boolean }> {
  if (timeoutMs === undefined || timeoutMs <= 0) {
    return { result: await promise, timedOut: false };
  }

  type Tagged =
    | { readonly source: "provider"; readonly result: CaseFactProviderResult<T> }
    | { readonly source: "timeout" };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<Tagged>((resolve) => {
    timer = setTimeout(() => resolve({ source: "timeout" }), timeoutMs);
  });
  const providerPromise = promise.then(
    (result): Tagged => ({ source: "provider", result })
  );

  try {
    const winner = await Promise.race([providerPromise, timeoutPromise]);
    if (winner.source === "timeout") {
      return {
        timedOut: true,
        result: {
          ok: false,
          degraded: true,
          failureReason: "unavailable",
          value: unknownFactory("timeout"),
        },
      };
    }
    return { result: winner.result, timedOut: false };
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Invoke Case fact providers and build a FactSnapshot.
 * Orchestration only — never returns CaseOutput; callers interpret separately.
 */
export async function assembleCaseFactSnapshot(
  providers: CaseFactAssemblerProviders,
  request: AssembleCaseFactSnapshotRequest
): Promise<AssembleCaseFactSnapshotResult> {
  const timeoutMs = request.providerTimeoutMs;
  const includeLedger = request.includeLedger !== false;
  const includeSignal = request.includeSignal !== false;

  const obligationP = invokeProvider(
    providers.obligation.readMoneyFacts(request.scope),
    timeoutMs,
    unknownMoneyFacts
  );
  const paymentP = invokeProvider(
    providers.payment.readPaymentFacts(request.scope),
    timeoutMs,
    unknownPaymentBundle
  );
  const evidenceP = invokeProvider(
    providers.evidence.readEvidenceFacts(request.scope),
    timeoutMs,
    unknownEvidenceFacts
  );
  const lifecycleP = invokeProvider(
    providers.lifecycle.readLifecycleFacts(request.scope),
    timeoutMs,
    unknownLifecycleBundle
  );

  const ledgerInvoked = includeLedger && providers.ledger !== undefined;
  const signalInvoked = includeSignal && providers.signal !== undefined;

  const ledgerP = ledgerInvoked
    ? invokeProvider(providers.ledger!.readAuditCues(request.scope), timeoutMs, unknownAuditCues)
    : Promise.resolve({
        result: {
          ok: true as const,
          value: unknownAuditCues("ledger_not_invoked"),
        },
        timedOut: false,
      });

  const signalP = signalInvoked
    ? invokeProvider(providers.signal!.readAttention(request.scope), timeoutMs, () =>
        unknownSignalBundle()
      )
    : Promise.resolve({
        result: { ok: true as const, value: unknownSignalBundle() },
        timedOut: false,
      });

  const [obligation, payment, evidence, lifecycle, ledger, signal] = await Promise.all([
    obligationP,
    paymentP,
    evidenceP,
    lifecycleP,
    ledgerP,
    signalP,
  ]);

  const attention = signalInvoked ? signal.result.value.attention : null;

  const snapshot = assembleFactSnapshot({
    identity: {
      subjectId: request.scope.subjectId,
      subjectKind: request.scope.subjectKind,
      caseKey: request.scope.caseKey,
      counterpartyId: request.scope.counterpartyId,
    },
    money: obligation.result.value,
    payment: payment.result.value,
    evidence: evidence.result.value,
    lifecycle: lifecycle.result.value,
    audit: ledger.result.value,
    mode: request.mode,
    attention,
  });

  return {
    snapshot,
    providers: {
      obligation: statusFromResult(true, obligation.result, obligation.timedOut),
      payment: statusFromResult(true, payment.result, payment.timedOut),
      evidence: statusFromResult(true, evidence.result, evidence.timedOut),
      lifecycle: statusFromResult(true, lifecycle.result, lifecycle.timedOut),
      ledger: statusFromResult(
        ledgerInvoked,
        ledgerInvoked ? ledger.result : null,
        ledger.timedOut
      ),
      signal: statusFromResult(
        signalInvoked,
        signalInvoked ? signal.result : null,
        signal.timedOut
      ),
    },
  };
}
