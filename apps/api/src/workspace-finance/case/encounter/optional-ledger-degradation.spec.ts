/**
 * PR15-H — Optional ledger degradation scenarios (adapter facts only; finance-core unchanged).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { interpretFinanceCase } from "@app-tour/finance-core/case";
import type { CaseFacts, FactSnapshot } from "@app-tour/finance-core/case";
import {
  mapDenaliEnrollmentIdentity,
  mapDenaliEvidenceToEvidenceFacts,
  mapDenaliLedgerToAuditCues,
  mapDenaliLifecycleToLifecycleFacts,
  mapDenaliObligationToMoneyFacts,
  mapDenaliPaymentToPaymentFacts,
} from "../../workspace-finance-case-read-bindings.generated";

import {
  createInMemoryEncounterTelemetrySink,
  safeEmitEncounterTelemetry,
} from "./encounter-telemetry.ts";
import {
  buildProviderDegradationTelemetryEvent,
  listProviderDegradationTelemetryEvents,
  normalizeProviderDegradationReason,
} from "./provider-degradation-telemetry.ts";

function baselineRequiredFacts(audit: CaseFacts["auditCues"]): CaseFacts {
  const money = mapDenaliObligationToMoneyFacts({
    readStatus: "ok",
    collectionMode: "offline",
    obligationMinor: "10000",
    remainingMinor: "10000",
    currency: "IRR",
    scheduleKind: "none",
    partialScopeDeclared: false,
  });
  const payment = mapDenaliPaymentToPaymentFacts({
    readStatus: "ok",
    payments: [
      {
        id: "p1",
        status: "Pending",
        method: "Manual",
        provider: "manual",
        amountMinor: "10000",
      },
    ],
    bookingPaymentStatus: "unpaid",
  });
  const evidence = mapDenaliEvidenceToEvidenceFacts({
    readStatus: "ok",
    receipt: null,
  });
  const lifecycle = mapDenaliLifecycleToLifecycleFacts({
    readStatus: "ok",
    bookingStatus: "approved",
    leftoverArtifactsProven: false,
    meaningConflictProven: false,
  });
  return {
    identity: mapDenaliEnrollmentIdentity({
      caseKey: "enrollment:subj:primary",
      subjectId: "subj",
      counterpartyId: "cp",
    }),
    eligibility: lifecycle.eligibility,
    money,
    intent: payment.intent,
    evidence,
    settlement: payment.settlement,
    exceptionCues: lifecycle.exceptionCues,
    auditCues: audit,
  };
}

function snap(facts: CaseFacts): FactSnapshot {
  return { facts, encounter: { mode: "lookup" } };
}

describe("PR15-H — optional ledger degradation", () => {
  it("A — ledger available: known audit cues; verdict from required facts", () => {
    const audit = mapDenaliLedgerToAuditCues({
      readStatus: "ok",
      ledgerRefsPresent: true,
      reconFinding: "none",
    });
    assert.equal(audit.ledgerRefsPresent.kind, "known");
    assert.equal(audit.ledgerRefsPresent.value, true);
    assert.equal(audit.reconFinding.kind, "known");
    assert.equal(audit.reconFinding.value, "none");

    const out = interpretFinanceCase(snap(baselineRequiredFacts(audit)));
    assert.equal(out.reading, "INTENT_OPEN_NO_PROOF");
    assert.notEqual(out.completenessClass, "inspect_forced");
  });

  it("B — ledger unavailable: same verdict; optional unknown; not inspect from ledger", () => {
    const auditOk = mapDenaliLedgerToAuditCues({
      readStatus: "ok",
      ledgerRefsPresent: false,
      reconFinding: "none",
    });
    const auditFailed = mapDenaliLedgerToAuditCues({ readStatus: "failed" });
    assert.equal(auditFailed.ledgerRefsPresent.kind, "unknown");
    assert.equal(
      auditFailed.ledgerRefsPresent.kind === "unknown"
        ? auditFailed.ledgerRefsPresent.reason
        : "",
      "ledger_read_failed"
    );

    const withOk = interpretFinanceCase(snap(baselineRequiredFacts(auditOk)));
    const withFailed = interpretFinanceCase(snap(baselineRequiredFacts(auditFailed)));
    assert.equal(withOk.reading, withFailed.reading);
    assert.equal(withOk.owner, withFailed.owner);
    assert.equal(withOk.primaryPosture, withFailed.primaryPosture);
    assert.equal(withFailed.completenessClass, "wait_complete");
  });

  it("C — ledger malformed/failed: unknown not fake values", () => {
    const failed = mapDenaliLedgerToAuditCues({ readStatus: "failed" });
    const missing = mapDenaliLedgerToAuditCues({ readStatus: "missing" });
    assert.equal(failed.ledgerRefsPresent.kind, "unknown");
    assert.notEqual(failed.ledgerRefsPresent.kind, "known");
    assert.equal(missing.ledgerRefsPresent.kind, "unknown");
    assert.equal(
      missing.ledgerRefsPresent.kind === "unknown" ? missing.ledgerRefsPresent.reason : "",
      "ledger_sot_missing"
    );
  });
});

describe("PR15-H — provider degradation telemetry", () => {
  it("tracks frequency, tenant, reason; redacts business vocab", () => {
    assert.equal(normalizeProviderDegradationReason("unavailable"), "unavailable");
    assert.equal(normalizeProviderDegradationReason("CaseOutput leaked"), "redacted");

    const sink = createInMemoryEncounterTelemetrySink();
    const events = listProviderDegradationTelemetryEvents({
      tenantId: "tenant-a",
      registrationId: "reg-1",
      recordedAtMs: 1,
      providers: {
        ledger: { invoked: true, ok: false, degraded: true, failureReason: "unavailable" },
        signal: { invoked: true, ok: false, degraded: true, failureReason: "unavailable" },
        obligation: { invoked: true, ok: true, degraded: false },
      },
    });
    assert.equal(events.length, 2);
    for (const event of events) {
      safeEmitEncounterTelemetry(sink, event);
    }
    assert.equal(sink.metrics.providerDegradationEvents, 2);
    assert.equal(sink.metrics.optionalProviderDegradations, 2);
    assert.equal(sink.metrics.ledgerDegradations, 1);
    assert.equal(sink.metrics.providerDegradationByReason.unavailable, 2);
    assert.ok(sink.metrics.tenantsSeen.has("tenant-a"));

    const single = buildProviderDegradationTelemetryEvent({
      tenantId: "tenant-a",
      registrationId: "reg-1",
      provider: "ledger",
      failureReason: "ledger_read_failed",
      optional: true,
      latencyMs: 12,
      recordedAtMs: 2,
    });
    assert.equal(single.kind, "provider_degradation");
    if (single.kind === "provider_degradation") {
      assert.equal(single.optional, true);
      assert.equal(single.latencyMs, 12);
    }
  });
});
