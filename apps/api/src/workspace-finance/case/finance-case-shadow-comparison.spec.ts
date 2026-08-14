/**
 * PR16-B — Finance Case shadow comparison (internal rollout).
 * Shadow observational only — never changes primary FinanceService behavior.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CaseOutput } from "@app-tour/finance-core/case";

import {
  buildFinanceCaseShadowReport,
  classifyOperationalObservation,
  compareFinanceCaseObservation,
  isFinanceCaseShadowEnabled,
  mapShadowMismatchTaxonomy,
  resolveFinanceCaseShadowRollout,
  scheduleDenaliFinanceCaseShadow,
  type FinanceCaseComparisonObservation,
} from "./index.ts";

const TENANT_A = "00000000-0000-4000-8000-000000000003";
const TENANT_B = "00000000-0000-4000-8000-000000000014";

function caseOutput(
  partial: Partial<CaseOutput> & Pick<CaseOutput, "reading" | "owner">
): CaseOutput {
  return {
    subjectId: "reg-1",
    subjectKind: "enrollment",
    caseKey: "enrollment:reg-1:primary",
    interpretationSentence: "test",
    decisionReady: false,
    lane: partial.lane ?? "daily",
    primaryPosture: "wait",
    allow: ["wait"],
    forbid: ["create_payment_repair"],
    confidence: {
      whyVisible: "t",
      whyMineOrNot: "t",
      ifIWait: "t",
      avoid: "t",
    },
    completenessClass: partial.completenessClass ?? "wait_complete",
    auditAltitude: false,
    ...partial,
  };
}

function obs(
  partial: Partial<FinanceCaseComparisonObservation> &
    Pick<FinanceCaseComparisonObservation, "category" | "taxonomyCode" | "caseKey">
): FinanceCaseComparisonObservation {
  return {
    executionId: "exec",
    observationId: "obs",
    triggerSource: "manual",
    interpreter: null,
    operational: null,
    degradedProviders: [],
    notes: [],
    latency: {
      executionDurationMs: 1,
      assembleDurationMs: 1,
      interpreterDurationMs: 1,
      comparisonDurationMs: 1,
      shadowDurationMs: 1,
    },
    recordedAtMs: 1,
    ...partial,
  };
}

describe("PR16-B shadow defaults + internal allowlist", () => {
  it("shadow disabled by default", () => {
    assert.equal(isFinanceCaseShadowEnabled({}), false);
    assert.equal(isFinanceCaseShadowEnabled({ FINANCE_CASE_SHADOW_ENABLED: "false" }), false);
    const decision = resolveFinanceCaseShadowRollout({
      tenantId: TENANT_A,
      env: {
        FINANCE_CASE_SHADOW_TENANTS: TENANT_A,
        FINANCE_CASE_ENCOUNTER_MODE: "internal",
        FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: TENANT_A,
      },
    });
    assert.equal(decision.run, false);
    if (!decision.run) {
      assert.equal(decision.reason, "disabled");
    }
  });

  it("empty SHADOW_TENANTS fails closed when enabled", () => {
    const decision = resolveFinanceCaseShadowRollout({
      tenantId: TENANT_A,
      enabled: true,
      env: { FINANCE_CASE_SHADOW_ENABLED: "true" },
    });
    assert.equal(decision.run, false);
    if (!decision.run) {
      assert.equal(decision.reason, "tenant_excluded");
    }
  });

  it("internal mode requires intersection with INTERNAL_TENANTS", () => {
    const excluded = resolveFinanceCaseShadowRollout({
      tenantId: TENANT_A,
      enabled: true,
      env: {
        FINANCE_CASE_ENCOUNTER_MODE: "internal",
        FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: TENANT_B,
        FINANCE_CASE_SHADOW_TENANTS: TENANT_A,
      },
    });
    assert.equal(excluded.run, false);

    const allowed = resolveFinanceCaseShadowRollout({
      tenantId: TENANT_A,
      enabled: true,
      env: {
        FINANCE_CASE_ENCOUNTER_MODE: "internal",
        FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: `${TENANT_A},${TENANT_B}`,
        FINANCE_CASE_SHADOW_TENANTS: TENANT_A,
        FINANCE_CASE_SHADOW_SAMPLE_RATE: "1",
      },
    });
    assert.equal(allowed.run, true);
  });

  it("schedule is no-op when disabled (zero primary impact)", () => {
    let ran = false;
    scheduleDenaliFinanceCaseShadow({
      tenantId: TENANT_A,
      registrationId: "r1",
      counterpartyId: "c1",
      trigger: "manual",
      env: { FINANCE_CASE_SHADOW_ENABLED: "false", FINANCE_CASE_SHADOW_TENANTS: TENANT_A },
      readDeps: {
        bookings: {
          async getById() {
            ran = true;
            return null;
          },
        },
        obligation: {
          async resolveRegistrationObligation() {
            ran = true;
            return null;
          },
          async resolveRegistrationPaymentCollection() {
            return "offline";
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
              paymentAmountsMinor: [],
              currency: "IRR",
            };
          },
          async findPaymentStatusesByRegistration() {
            return [];
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
      },
    });
    assert.equal(ran, false);
  });
});

describe("PR16-B mismatch taxonomy + scenarios A–D", () => {
  it("A — normal settled payment → ALIGNED / VERDICT compatible", () => {
    const primary = { financeCategory: "settled" as const, ok: true };
    const compared = compareFinanceCaseObservation({
      caseOutput: caseOutput({
        reading: "SETTLED_CAPTURED",
        owner: "idle",
        decisionReady: true,
      }),
      operational: classifyOperationalObservation({
        bookingStatus: "approved",
        bookingPaymentStatus: "paid",
        hasPendingManualPayment: false,
        latestReceiptStatus: "Approved",
        inPendingReceiptQueue: false,
      }),
    });
    assert.equal(primary.ok, true);
    assert.equal(compared.category, "aligned");
    assert.equal(
      mapShadowMismatchTaxonomy({
        category: compared.category,
        taxonomyHints: compared.taxonomyHints,
      }),
      "ALIGNED"
    );
  });

  it("B — pending receipt → Case AWAITING_FINANCE aligns with ops review queue", () => {
    const primary = { pendingReceiptQueue: true, unchanged: true };
    const compared = compareFinanceCaseObservation({
      caseOutput: caseOutput({ reading: "AWAITING_FINANCE", owner: "finance" }),
      operational: classifyOperationalObservation({
        bookingStatus: "approved",
        bookingPaymentStatus: "unpaid",
        hasPendingManualPayment: false,
        latestReceiptStatus: "Pending",
        inPendingReceiptQueue: true,
      }),
    });
    assert.equal(primary.unchanged, true);
    assert.equal(compared.category, "aligned");
    assert.deepEqual(compared.taxonomyHints, ["ALIGNED"]);
  });

  it("C — paid with remaining conflict → EXCEPTION taxonomy path", () => {
    const primary = { bookingPaymentStatus: "paid", remainingConflict: true };
    const compared = compareFinanceCaseObservation({
      caseOutput: caseOutput({
        reading: "EXCEPTION",
        owner: "exception_policy",
        lane: "exception",
      }),
      operational: classifyOperationalObservation({
        bookingStatus: "approved",
        bookingPaymentStatus: "paid",
        hasPendingManualPayment: false,
        latestReceiptStatus: null,
        inPendingReceiptQueue: false,
      }),
    });
    assert.equal(primary.remainingConflict, true);
    assert.equal(compared.category, "exception_disagreement");
    assert.equal(
      mapShadowMismatchTaxonomy({
        category: compared.category,
        taxonomyHints: compared.taxonomyHints,
      }),
      "EXCEPTION_MISMATCH"
    );
  });

  it("D — missing optional provider → still comparable (PR15-H); primary unchanged", () => {
    const primary = { ok: true as const };
    const compared = compareFinanceCaseObservation({
      caseOutput: caseOutput({ reading: "SETTLED_CAPTURED", owner: "idle" }),
      operational: classifyOperationalObservation({
        bookingStatus: "approved",
        bookingPaymentStatus: "paid",
        hasPendingManualPayment: false,
        latestReceiptStatus: null,
        inPendingReceiptQueue: false,
      }),
      degradedProviders: ["ledger"],
    });
    assert.equal(primary.ok, true);
    assert.equal(compared.category, "aligned");
    assert.ok(
      compared.notes.some((n) => n.includes("optional_provider_degraded:ledger"))
    );
    assert.equal(
      mapShadowMismatchTaxonomy({
        category: compared.category,
        notes: compared.notes,
        taxonomyHints: compared.taxonomyHints,
      }),
      "ALIGNED"
    );
  });

  it("D2 — missing required provider → MISSING_FACT_COVERAGE", () => {
    const compared = compareFinanceCaseObservation({
      caseOutput: caseOutput({ reading: "SETTLED_CAPTURED", owner: "idle" }),
      operational: classifyOperationalObservation({
        bookingStatus: "approved",
        bookingPaymentStatus: "paid",
        hasPendingManualPayment: false,
        latestReceiptStatus: null,
        inPendingReceiptQueue: false,
      }),
      degradedProviders: ["obligation"],
    });
    assert.equal(compared.category, "uncomparable");
    assert.equal(
      mapShadowMismatchTaxonomy({
        category: compared.category,
        notes: compared.notes,
        taxonomyHints: compared.taxonomyHints,
      }),
      "MISSING_FACT_COVERAGE"
    );
  });

  it("maps engine categories to operator taxonomy codes", () => {
    assert.equal(
      mapShadowMismatchTaxonomy({ category: "reading_disagreement" }),
      "VERDICT_MISMATCH"
    );
    assert.equal(
      mapShadowMismatchTaxonomy({ category: "owner_disagreement" }),
      "OWNERSHIP_MISMATCH"
    );
    assert.equal(
      mapShadowMismatchTaxonomy({
        category: "uncomparable",
        notes: ["incomplete_or_degraded_snapshot"],
      }),
      "MISSING_FACT_COVERAGE"
    );
  });
});

describe("PR16-B shadow report", () => {
  it("aggregates totals, match %, taxonomy, tenants, case keys", () => {
    const report = buildFinanceCaseShadowReport({
      observations: [
        obs({
          category: "aligned",
          taxonomyCode: "ALIGNED",
          caseKey: "enrollment:a:primary",
        }),
        obs({
          category: "aligned",
          taxonomyCode: "ALIGNED",
          caseKey: "enrollment:b:primary",
        }),
        obs({
          category: "reading_disagreement",
          taxonomyCode: "VERDICT_MISMATCH",
          caseKey: "enrollment:c:primary",
        }),
        obs({
          category: "uncomparable",
          taxonomyCode: "MISSING_FACT_COVERAGE",
          caseKey: "enrollment:d:primary",
          degradedProviders: ["ledger"],
          notes: ["incomplete_or_degraded_snapshot"],
        }),
      ],
      tenantIds: [TENANT_A, TENANT_A, TENANT_B, TENANT_A],
      now: () => 42,
    });

    assert.equal(report.totalComparisons, 4);
    assert.equal(report.matchedCount, 2);
    assert.equal(report.matchedPercentage, 2 / 3);
    assert.equal(report.mismatchByTaxonomy.ALIGNED, 2);
    assert.equal(report.mismatchByTaxonomy.VERDICT_MISMATCH, 1);
    assert.equal(report.mismatchByTaxonomy.MISSING_FACT_COVERAGE, 1);
    assert.deepEqual(report.affectedTenants, [TENANT_A, TENANT_B].sort());
    assert.equal(report.affectedCaseKeys.length, 4);
    assert.equal(report.providerDegradationEvents, 1);
    assert.equal(report.affectsPrimaryResponse, false);
    assert.equal(report.blocksFinanceService, false);
    assert.equal(report.mutatesFlags, false);
    assert.equal(report.generatedAtMs, 42);
  });
});
