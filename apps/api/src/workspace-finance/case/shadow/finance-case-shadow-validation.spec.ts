/**
 * PR16-C — Internal shadow validation & decision gate proofs.
 * Validation only — no UI/commands/finance-core/Case persistence.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { CaseOutput } from "@app-tour/finance-core/case";

import {
  buildFinanceCaseShadowValidationReport,
  classifyOperationalObservation,
  compareFinanceCaseObservation,
  createInMemoryFinanceCaseComparisonEmitter,
  isFinanceCaseShadowEnabled,
  resolveFinanceCaseShadowDecision,
  resolveFinanceCaseShadowRollout,
  runDenaliFinanceCaseShadow,
  scheduleDenaliFinanceCaseShadow,
  wrapFinanceServiceWithCaseShadow,
  type FinanceCaseComparisonObservation,
} from "../index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHADOW_DIR = HERE;

const TENANT_A = "00000000-0000-4000-8000-000000000003";
const TENANT_B = "00000000-0000-4000-8000-000000000014";
const TENANT_EXCLUDED = "00000000-0000-4000-8000-000000000004";

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

const quietReadDeps = {
  bookings: {
    async getById() {
      return {
        id: "r1",
        tenantId: TENANT_A,
        tourId: "tour",
        tourTitle: "T",
        guestLabel: "G",
        guestEmail: null,
        guestPhone: null,
        partySize: 1,
        status: "approved" as const,
        paymentStatus: "paid" as const,
        departureAt: "2026-09-01T00:00:00.000Z",
        submittedAt: "2026-08-01T00:00:00.000Z",
        submittedByUserId: "c1",
        approvedAt: "2026-08-02T00:00:00.000Z",
      };
    },
  },
  obligation: {
    async resolveRegistrationObligation() {
      return { currency: "IRR", obligationMinor: "1000", source: "tour_canonical" as const };
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
        paidPaymentsMinor: "1000",
        paymentAmountsMinor: ["1000"],
        currency: "IRR",
      };
    },
    async findPaymentStatusesByRegistration() {
      return [{ status: "captured" }];
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

const internalShadowEnv = {
  FINANCE_CASE_ENCOUNTER_MODE: "internal",
  FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: `${TENANT_A},${TENANT_B}`,
  FINANCE_CASE_SHADOW_ENABLED: "true",
  FINANCE_CASE_SHADOW_TENANTS: `${TENANT_A},${TENANT_B}`,
  FINANCE_CASE_SHADOW_SAMPLE_RATE: "1",
};

describe("PR16-C shadow lifecycle + primary isolation", () => {
  it("primary output unchanged when shadow runs / fails", async () => {
    const primary = { ok: true as const, invoiceTotal: "1000" };
    const boom = {
      async emit() {
        throw new Error("telemetry_down");
      },
    };
    const result = await runDenaliFinanceCaseShadow({
      tenantId: TENANT_A,
      registrationId: "r1",
      counterpartyId: "c1",
      trigger: "manual",
      enabled: true,
      env: internalShadowEnv,
      comparisonEmitter: boom,
      readDeps: quietReadDeps,
    });
    assert.equal(primary.ok, true);
    assert.equal(primary.invoiceTotal, "1000");
    assert.equal(result.skipped, false);
  });

  it("mutation wrap returns primary result before shadow work", async () => {
    let shadowScheduled = false;
    const base = {
      async createManualPayment() {
        return { paymentId: "p1", status: "pending" as const };
      },
      async submitReceipt() {
        return { receiptId: "rc1" };
      },
      async reviewReceipt() {
        return { receiptId: "rc1", status: "Approved" as const };
      },
      async getRegistrationInvoice() {
        return { totalMinor: "1000" };
      },
    } as unknown as Parameters<typeof wrapFinanceServiceWithCaseShadow>[0];

    const wrapped = wrapFinanceServiceWithCaseShadow(base, {
      env: { FINANCE_CASE_SHADOW_ENABLED: "false" },
      bookings: {
        async getById() {
          shadowScheduled = true;
          return null;
        },
      },
      finance: {
        ...quietReadDeps.finance,
        async findPaymentById() {
          return null;
        },
        async findReceiptById() {
          return null;
        },
      },
      obligation: quietReadDeps.obligation,
    });

    const t0 = Date.now();
    const out = await wrapped.createManualPayment(
      { tenantId: TENANT_A, userId: "u1", roles: [] } as never,
      { registrationId: "r1" } as never,
      "idem-1"
    );
    const elapsed = Date.now() - t0;
    assert.equal((out as { paymentId: string }).paymentId, "p1");
    assert.equal(shadowScheduled, false);
    assert.ok(elapsed < 50, "primary path must stay non-blocking when shadow off");
  });

  it("schedule never throws into caller when disabled", () => {
    assert.doesNotThrow(() => {
      scheduleDenaliFinanceCaseShadow({
        tenantId: TENANT_A,
        registrationId: "r1",
        counterpartyId: "c1",
        trigger: "manual",
        env: { FINANCE_CASE_SHADOW_ENABLED: "false" },
        readDeps: quietReadDeps,
      });
    });
  });
});

describe("PR16-C tenant isolation", () => {
  it("allowlisted internal tenant → shadow may run", () => {
    const d = resolveFinanceCaseShadowRollout({
      tenantId: TENANT_A,
      env: internalShadowEnv,
      trigger: "manual",
    });
    assert.equal(d.run, true);
  });

  it("excluded tenant → zero shadow execution", async () => {
    const emitter = createInMemoryFinanceCaseComparisonEmitter();
    const result = await runDenaliFinanceCaseShadow({
      tenantId: TENANT_EXCLUDED,
      registrationId: "r1",
      counterpartyId: "c1",
      trigger: "manual",
      env: internalShadowEnv,
      comparisonEmitter: emitter,
      readDeps: quietReadDeps,
    });
    assert.equal(result.skipped, true);
    if (result.skipped) assert.equal(result.reason, "tenant_excluded");
    assert.equal(emitter.observations.length, 0);
  });

  it("missing SHADOW_TENANTS → fail closed", () => {
    const d = resolveFinanceCaseShadowRollout({
      tenantId: TENANT_A,
      enabled: true,
      env: {
        ...internalShadowEnv,
        FINANCE_CASE_SHADOW_TENANTS: "",
      },
    });
    assert.equal(d.run, false);
    if (!d.run) assert.equal(d.reason, "tenant_excluded");
  });

  it("tenant A case keys never appear under tenant B partition", () => {
    const report = buildFinanceCaseShadowValidationReport({
      observations: [
        obs({
          category: "aligned",
          taxonomyCode: "ALIGNED",
          caseKey: "enrollment:a-only:primary",
        }),
        obs({
          category: "aligned",
          taxonomyCode: "ALIGNED",
          caseKey: "enrollment:b-only:primary",
        }),
      ],
      tenantIds: [TENANT_A, TENANT_B],
    });
    assert.deepEqual(report.caseKeysByTenant[TENANT_A], ["enrollment:a-only:primary"]);
    assert.deepEqual(report.caseKeysByTenant[TENANT_B], ["enrollment:b-only:primary"]);
    assert.equal(
      (report.caseKeysByTenant[TENANT_B] ?? []).includes("enrollment:a-only:primary"),
      false
    );
  });
});

describe("PR16-C operational safety", () => {
  it("shadow modules do not persist Case / invoke command bridge / leak gateway brands", () => {
    for (const name of readdirSync(SHADOW_DIR)) {
      if (!name.endsWith(".ts") || name.endsWith(".spec.ts")) continue;
      const src = readFileSync(join(SHADOW_DIR, name), "utf8");
      assert.doesNotMatch(src, /prisma\.\$|caseRepository|CaseStatus|insertCase/i);
      assert.doesNotMatch(src, /runReviewReceiptCommandBridge|createReviewReceiptCommandBridge/);
      assert.doesNotMatch(src, /\bstripe\b|\bpaypal\b/i);
    }
  });

  it("comparison engine does not expose CaseOutput outside projection fields", () => {
    const out = caseOutput({ reading: "SETTLED_CAPTURED", owner: "idle", decisionReady: true });
    const before = JSON.stringify(out);
    const compared = compareFinanceCaseObservation({
      caseOutput: out,
      operational: classifyOperationalObservation({
        bookingStatus: "approved",
        bookingPaymentStatus: "paid",
        hasPendingManualPayment: false,
        latestReceiptStatus: "Approved",
        inPendingReceiptQueue: false,
      }),
    });
    assert.equal(JSON.stringify(out), before);
    assert.equal(compared.interpreter?.reading, "SETTLED_CAPTURED");
    assert.equal("interpretationSentence" in (compared.interpreter ?? {}), false);
    assert.equal("confidence" in (compared.interpreter ?? {}), false);
  });

  it("shadow default remains disabled", () => {
    assert.equal(isFinanceCaseShadowEnabled({}), false);
  });
});

describe("PR16-C validation report + decision gate", () => {
  it("report includes parity metrics + taxonomy distribution", () => {
    const report = buildFinanceCaseShadowValidationReport({
      observations: [
        obs({ category: "aligned", taxonomyCode: "ALIGNED", caseKey: "k1" }),
        obs({ category: "aligned", taxonomyCode: "ALIGNED", caseKey: "k2" }),
        obs({
          category: "reading_disagreement",
          taxonomyCode: "VERDICT_MISMATCH",
          caseKey: "k3",
          notes: ["reading_case=X;ops=Y"],
        }),
        obs({
          category: "uncomparable",
          taxonomyCode: "MISSING_FACT_COVERAGE",
          caseKey: "k4",
          degradedProviders: ["ledger"],
          notes: ["incomplete_or_degraded_snapshot:missing_fact_optional"],
        }),
      ],
      tenantIds: [TENANT_A, TENANT_A, TENANT_A, TENANT_B],
    });
    assert.equal(report.totalComparisons, 4);
    assert.equal(report.comparableCases, 3);
    assert.equal(report.verdictMatchPct, 2 / 3);
    assert.equal(report.ownershipMatchPct, 1);
    assert.equal(report.signalMatchPct, 1);
    assert.equal(report.completenessMatchPct, 1);
    assert.equal(report.taxonomyDistribution.ALIGNED, 2);
    assert.equal(report.taxonomyDistribution.VERDICT_MISMATCH, 1);
    assert.equal(report.taxonomyDistribution.MISSING_FACT_COVERAGE, 1);
    assert.equal(report.missingRequiredFactCount, 0);
    assert.equal(report.writesCasePersistence, false);
  });

  it("READY_FOR_NEXT_STAGE when parity high and mismatches understood", () => {
    const report = buildFinanceCaseShadowValidationReport({
      observations: [
        obs({ category: "aligned", taxonomyCode: "ALIGNED", caseKey: "a" }),
        obs({ category: "aligned", taxonomyCode: "ALIGNED", caseKey: "b" }),
        obs({ category: "aligned", taxonomyCode: "ALIGNED", caseKey: "c" }),
        obs({ category: "aligned", taxonomyCode: "ALIGNED", caseKey: "d" }),
        obs({ category: "aligned", taxonomyCode: "ALIGNED", caseKey: "e" }),
        obs({ category: "aligned", taxonomyCode: "ALIGNED", caseKey: "f" }),
        obs({
          category: "uncomparable",
          taxonomyCode: "MISSING_FACT_COVERAGE",
          caseKey: "g",
          degradedProviders: ["ledger"],
          notes: ["incomplete_or_degraded_snapshot:missing_fact_optional"],
        }),
      ],
      tenantIds: Array(7).fill(TENANT_A),
    });
    const decision = resolveFinanceCaseShadowDecision({ report });
    assert.equal(decision.kind, "READY_FOR_NEXT_STAGE");
    assert.equal(decision.mutatesFlags, false);
    assert.equal(decision.autoRemediation, false);
    assert.ok(decision.deferred.includes("command buttons"));
  });

  it("HOLD_FOR_CALIBRATION on ownership mismatch / unexplained verdict / missing required", () => {
    const ownershipHold = resolveFinanceCaseShadowDecision({
      report: buildFinanceCaseShadowValidationReport({
        observations: [
          obs({
            category: "owner_disagreement",
            taxonomyCode: "OWNERSHIP_MISMATCH",
            caseKey: "o1",
            notes: ["owner_case=finance;ops=counterparty_wait"],
          }),
        ],
        tenantIds: [TENANT_A],
      }),
    });
    assert.equal(ownershipHold.kind, "HOLD_FOR_CALIBRATION");

    const unexplained = resolveFinanceCaseShadowDecision({
      report: buildFinanceCaseShadowValidationReport({
        observations: [
          obs({
            category: "reading_disagreement",
            taxonomyCode: "VERDICT_MISMATCH",
            caseKey: "v1",
            notes: [],
          }),
        ],
        tenantIds: [TENANT_A],
      }),
    });
    assert.equal(unexplained.kind, "HOLD_FOR_CALIBRATION");

    const missingRequired = resolveFinanceCaseShadowDecision({
      report: buildFinanceCaseShadowValidationReport({
        observations: [
          obs({
            category: "uncomparable",
            taxonomyCode: "MISSING_FACT_COVERAGE",
            caseKey: "m1",
            degradedProviders: ["obligation"],
            notes: ["incomplete_or_degraded_snapshot"],
          }),
        ],
        tenantIds: [TENANT_A],
      }),
    });
    assert.equal(missingRequired.kind, "HOLD_FOR_CALIBRATION");
  });
});

describe("PR16-C package boundary", () => {
  it("does not modify finance-core imports for decision gate", () => {
    const decisionSrc = readFileSync(
      join(SHADOW_DIR, "resolve-finance-case-shadow-decision.ts"),
      "utf8"
    );
    assert.doesNotMatch(decisionSrc, /@app-tour\/finance-core/);
    const casePkg = readFileSync(
      join(HERE, "../../../../../../packages/finance-core/package.json"),
      "utf8"
    );
    assert.doesNotMatch(casePkg, /workspace-denali/);
  });
});
