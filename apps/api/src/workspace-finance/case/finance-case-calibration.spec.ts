/**
 * PR5-B — production calibration & observation hardening proofs.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FactSnapshot } from "@app-tour/finance-core/case";
import { absentFact, knownFact, unknownFact } from "@app-tour/finance-core/case";

import {
  assertObservationMetricsHaveNoPersistenceConcepts,
  buildFactCoverageReport,
  calibrateMismatch,
  createProductionObservationSink,
  evaluateFinanceCaseQualityGates,
  resolveFinanceCaseShadowRollout,
  runDenaliFinanceCaseShadow,
  type FinanceCaseComparisonObservation,
} from "./index.ts";

function baselineSnapshot(overrides?: {
  readonly amountDue?: ReturnType<typeof unknownFact> | ReturnType<typeof knownFact<string>>;
  readonly attention?: boolean;
}): FactSnapshot {
  return {
    facts: {
      identity: {
        subjectId: "reg-1",
        subjectKind: "enrollment",
        caseKey: "enrollment:reg-1:primary",
        counterpartyId: "c1",
      },
      eligibility: { lifecycleEligibility: knownFact("eligible") },
      money: {
        obligationPresent: knownFact(true),
        collectionPolicy: knownFact("money_due"),
        amountDue: overrides?.amountDue ?? knownFact("10000"),
        remaining: knownFact("10000"),
        currency: knownFact("IRR"),
        scheduleKind: knownFact("none"),
        partialScopeDeclared: knownFact(false),
      },
      intent: {
        intentSet: knownFact("none"),
        intentKind: knownFact("other"),
        intentOpen: knownFact(false),
        provenanceKnown: knownFact(true),
        duplicateOrParallelSuspected: knownFact(false),
      },
      evidence: {
        proofExists: absentFact(),
        proofProgress: knownFact("none"),
        evidenceInspectable: knownFact(false),
        evidenceSource: knownFact("other"),
      },
      settlement: { settlementMeaning: knownFact("unsettled") },
      exceptionCues: {
        closedWithLeftoverArtifacts: knownFact(false),
        meaningConflict: knownFact(false),
      },
      auditCues: {
        ledgerRefsPresent: knownFact(false),
        reconFinding: knownFact("none"),
      },
    },
    encounter: {
      mode: "lookup",
      ...(overrides?.attention === true
        ? { attention: { attentionClass: "unsettled_obligation" } }
        : {}),
    },
  };
}

function comparisonObs(
  partial: Partial<FinanceCaseComparisonObservation> &
    Pick<FinanceCaseComparisonObservation, "category">
): FinanceCaseComparisonObservation {
  return {
    executionId: "exec-1",
    observationId: "obs-1",
    caseKey: "enrollment:reg-1:primary",
    triggerSource: "manual",
    taxonomyCode:
      partial.category === "aligned"
        ? "ALIGNED"
        : partial.category === "owner_disagreement"
          ? "OWNERSHIP_MISMATCH"
          : partial.category === "reading_disagreement"
            ? "VERDICT_MISMATCH"
            : partial.category === "exception_disagreement"
              ? "EXCEPTION_MISMATCH"
              : partial.category === "eligibility_disagreement"
                ? "ELIGIBILITY_MISMATCH"
                : "UNCOMPARABLE",
    interpreter: null,
    operational: null,
    degradedProviders: [],
    notes: [],
    latency: {
      executionDurationMs: 10,
      assembleDurationMs: 4,
      interpreterDurationMs: 2,
      comparisonDurationMs: 3,
      shadowDurationMs: 12,
    },
    recordedAtMs: Date.now(),
    ...partial,
  };
}

const quietReadDeps = {
  bookings: {
    async getById() {
      return {
        id: "r1",
        tenantId: "t1",
        tourId: "tour",
        tourTitle: "T",
        guestLabel: "G",
        guestEmail: null,
        guestPhone: null,
        partySize: 1,
        status: "approved" as const,
        paymentStatus: "unpaid" as const,
        departureAt: "2026-09-01T00:00:00.000Z",
        submittedAt: "2026-08-01T00:00:00.000Z",
        submittedByUserId: "c1",
        approvedAt: "2026-08-02T00:00:00.000Z",
      };
    },
  },
  obligation: {
    async resolveRegistrationObligation() {
      return { currency: "IRR", obligationMinor: "5000", source: "tour_canonical" as const };
    },
    async resolveRegistrationPaymentCollection() {
      return "offline" as const;
    },
  },
  finance: {
    async findLatestReceiptForRegistration() {
      return null;
    },
    async getRegistrationInvoiceFacts() {
      return {
        prepaymentMinor: "0",
        paidPaymentsMinor: "0",
        paymentAmountsMinor: [] as string[],
        currency: "IRR",
      };
    },
    async findPaymentStatusesByRegistration() {
      return [] as { status: string }[];
    },
    async findFirstPendingManualPayment() {
      return null;
    },
    async listPendingReceipts() {
      return { rows: [], nextCursor: null, hasMore: false };
    },
    async listLedgerEvents() {
      return [];
    },
  },
};

describe("PR5-B production calibration", () => {
  it("1 — sink failure cannot affect workflow", async () => {
    const primary = { ok: true as const };
    const boom = {
      async record() {
        throw new Error("production_sink_down");
      },
      snapshotMetrics() {
        throw new Error("unreachable");
      },
      evaluateQualityGates() {
        throw new Error("unreachable");
      },
    };
    const result = await runDenaliFinanceCaseShadow({
      tenantId: "t1",
      registrationId: "r1",
      counterpartyId: "c1",
      trigger: "manual",
      enabled: true,
      env: { FINANCE_CASE_SHADOW_TENANTS: "t1" },
      productionObservationSink: boom,
      readDeps: quietReadDeps,
    });
    assert.equal(primary.ok, true);
    assert.equal(result.skipped, false);
  });

  it("2 — metrics contain no Case persistence concepts", async () => {
    const sink = createProductionObservationSink();
    await sink.record({
      comparison: comparisonObs({ category: "aligned" }),
      snapshot: baselineSnapshot(),
    });
    const metrics = sink.snapshotMetrics();
    assert.equal(metrics.executionCount, 1);
    assert.equal(metrics.comparableCount, 1);
    assert.doesNotThrow(() => assertObservationMetricsHaveNoPersistenceConcepts(metrics));
    const blob = JSON.stringify(metrics);
    assert.doesNotMatch(blob, /caseStatus|ownerHistory|workflowState|caseRepository/i);
  });

  it("3 — unknown facts remain unknown", () => {
    const coverage = buildFactCoverageReport({
      snapshot: baselineSnapshot({ amountDue: unknownFact("provider_timeout") }),
    });
    const obligation = coverage.providers.find((p) => p.provider === "obligation");
    assert.ok(obligation);
    assert.equal(obligation.unknown >= 1, true);
    assert.equal(obligation.absent, 0);
    // Degraded unknown stays in unknown bucket — never coerced to absent/zero.
    const degraded = buildFactCoverageReport({
      snapshot: baselineSnapshot(),
      degradedProviders: ["obligation"],
    });
    const obl = degraded.providers.find((p) => p.provider === "obligation");
    assert.ok(obl);
    assert.equal(obl.degraded, obl.totalFields);
    assert.equal(obl.known, 0);
    assert.equal(obl.unknown, obl.totalFields);
  });

  it("4 — sampling / trigger selection works correctly", () => {
    const sampledOut = resolveFinanceCaseShadowRollout({
      tenantId: "t1",
      enabled: true,
      env: {
        FINANCE_CASE_SHADOW_TENANTS: "t1",
        FINANCE_CASE_SHADOW_SAMPLE_RATE: "0.1",
      },
      random: () => 0.9,
    });
    assert.equal(sampledOut.run, false);
    if (!sampledOut.run) {
      assert.equal(sampledOut.reason, "sampled_out");
    }

    const triggerExcluded = resolveFinanceCaseShadowRollout({
      tenantId: "t1",
      enabled: true,
      trigger: "finance_read",
      env: {
        FINANCE_CASE_SHADOW_TENANTS: "t1",
        FINANCE_CASE_SHADOW_TRIGGERS: "post_receipt_submit,manual",
      },
    });
    assert.equal(triggerExcluded.run, false);
    if (!triggerExcluded.run) {
      assert.equal(triggerExcluded.reason, "trigger_excluded");
    }

    const triggerAllowed = resolveFinanceCaseShadowRollout({
      tenantId: "t1",
      enabled: true,
      trigger: "manual",
      env: {
        FINANCE_CASE_SHADOW_TENANTS: "t1",
        FINANCE_CASE_SHADOW_TRIGGERS: "manual,post_payment_mutation",
      },
    });
    assert.equal(triggerAllowed.run, true);
  });

  it("5 — same facts produce same metrics classification", async () => {
    const snap = baselineSnapshot({ amountDue: unknownFact("gap") });
    const coverage = buildFactCoverageReport({ snapshot: snap });
    const a = calibrateMismatch({
      category: "reading_disagreement",
      coverage,
      notes: ["x"],
    });
    const b = calibrateMismatch({
      category: "reading_disagreement",
      coverage,
      notes: ["x"],
    });
    assert.deepEqual(a, b);
    assert.equal(a.calibrationClass, "adapter_translation_issue");

    const sink = createProductionObservationSink();
    const obs = comparisonObs({ category: "owner_disagreement" });
    await sink.record({ comparison: obs, snapshot: baselineSnapshot() });
    await sink.record({ comparison: obs, snapshot: baselineSnapshot() });
    const metrics = sink.snapshotMetrics();
    assert.equal(metrics.executionCount, 2);
    assert.equal(metrics.calibrationByClass.operational_heuristic_drift, 2);
  });

  it("6 — comparison remains observational (skip reads + quality gates never block)", async () => {
    let pendingReceiptReads = 0;
    const readDeps = {
      ...quietReadDeps,
      finance: {
        ...quietReadDeps.finance,
        async listPendingReceipts() {
          pendingReceiptReads += 1;
          return { rows: [], nextCursor: null, hasMore: false };
        },
      },
    };

    const skipped = await runDenaliFinanceCaseShadow({
      tenantId: "t1",
      registrationId: "r1",
      counterpartyId: "c1",
      trigger: "manual",
      enabled: true,
      env: {
        FINANCE_CASE_SHADOW_TENANTS: "t1",
        FINANCE_CASE_SHADOW_SKIP_COMPARISON_READS: "1",
      },
      readDeps,
    });
    assert.equal(skipped.skipped, false);
    if (!skipped.skipped) {
      assert.equal(skipped.comparison?.category, "uncomparable");
      assert.ok(skipped.comparison?.notes.includes("comparison_reads_skipped_cost_control"));
    }
    // Shadow Case may still read queue once; skip mode must not add a second ops fan-out.
    assert.equal(pendingReceiptReads, 1);

    pendingReceiptReads = 0;
    await runDenaliFinanceCaseShadow({
      tenantId: "t1",
      registrationId: "r1",
      counterpartyId: "c1",
      trigger: "manual",
      enabled: true,
      env: { FINANCE_CASE_SHADOW_TENANTS: "t1" },
      readDeps,
    });
    assert.equal(pendingReceiptReads, 2);

    const gates = evaluateFinanceCaseQualityGates({
      shadowExecutions: 10,
      comparableRuns: 2,
      exceptionDisagreements: 5,
      providerDegradationEvents: 8,
      requiredUnknownFields: 40,
      requiredTotalFields: 50,
    });
    assert.equal(gates.blocksWorkflow, false);
    assert.equal(gates.ok, false);
  });
});

describe("PR5-B coverage + calibration taxonomy", () => {
  it("covers required provider groups", () => {
    const report = buildFactCoverageReport({ snapshot: baselineSnapshot({ attention: true }) });
    const names = report.providers.map((p) => p.provider);
    assert.deepEqual(names, [
      "obligation",
      "payment",
      "evidence",
      "lifecycle",
      "ledger",
      "signal",
    ]);
    assert.equal(report.providers.find((p) => p.provider === "signal")?.known, 1);
  });

  it("maps exception disagreement to real_ambiguity", () => {
    const coverage = buildFactCoverageReport({ snapshot: baselineSnapshot() });
    const result = calibrateMismatch({
      category: "exception_disagreement",
      coverage,
    });
    assert.equal(result.calibrationClass, "real_ambiguity");
  });

  it("aligned → none", () => {
    const coverage = buildFactCoverageReport({ snapshot: baselineSnapshot() });
    assert.equal(
      calibrateMismatch({ category: "aligned", coverage }).calibrationClass,
      "none"
    );
  });

  it("observation modules stay measurement-only (no remediation / persistence)", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = join(dirname(fileURLToPath(import.meta.url)), "observation");
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".ts")) continue;
      const src = readFileSync(join(dir, name), "utf8");
      assert.doesNotMatch(src, /createManualPayment|reviewReceipt|approveReceipt|updateBooking|mutateWorkflow/);
      assert.doesNotMatch(src, /from ["']@prisma|prisma\.\$|FinanceService\b/);
      assert.doesNotMatch(src, /autoFix|auto_remediat|blocksWorkflow:\s*true/);
      // Quality gates must hard-code blocksWorkflow: false when present.
      if (/blocksWorkflow/.test(src)) {
        assert.match(src, /blocksWorkflow:\s*false/);
      }
    }
  });
});
