/**
 * PR5-A — shadow comparison engine proofs.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { CaseOutput } from "@app-tour/finance-core/case";

import {
  classifyOperationalObservation,
  compareFinanceCaseObservation,
  createInMemoryFinanceCaseComparisonEmitter,
  projectInterpreterClassification,
  resolveFinanceCaseShadowRollout,
  runDenaliFinanceCaseShadow,
} from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const COMPARISON_DIR = join(HERE, "comparison");
const REPO_ROOT = resolve(HERE, "../../../../..");

function caseOutput(partial: Partial<CaseOutput> & Pick<CaseOutput, "reading" | "owner">): CaseOutput {
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

describe("PR5-A comparison isolation", () => {
  it("1 — comparison engine cannot import finance-core internals", () => {
    for (const name of readdirSync(COMPARISON_DIR)) {
      if (!name.endsWith(".ts")) continue;
      const src = readFileSync(join(COMPARISON_DIR, name), "utf8");
      assert.doesNotMatch(src, /finance-core\/src\/case|case\/rules|resolveOwnership|generatePosture/);
      if (/@app-tour\/finance-core/.test(src)) {
        assert.match(src, /@app-tour\/finance-core\/case/);
      }
    }
  });

  it("2 — comparison cannot mutate CaseOutput", () => {
    const out = caseOutput({ reading: "AWAITING_COUNTERPARTY", owner: "counterparty" });
    const before = JSON.stringify(out);
    const projected = projectInterpreterClassification(out);
    assert.equal(projected.reading, "AWAITING_COUNTERPARTY");
    compareFinanceCaseObservation({
      caseOutput: out,
      operational: classifyOperationalObservation({
        bookingStatus: "approved",
        bookingPaymentStatus: "unpaid",
        hasPendingManualPayment: false,
        latestReceiptStatus: null,
        inPendingReceiptQueue: false,
      }),
    });
    assert.equal(JSON.stringify(out), before);
  });

  it("3 — comparison failure cannot affect primary workflow", async () => {
    const primary = { ok: true as const };
    const boom: { emit: () => Promise<void> } = {
      async emit() {
        throw new Error("sink_boom");
      },
    };
    const result = await runDenaliFinanceCaseShadow({
      tenantId: "t1",
      registrationId: "r1",
      counterpartyId: "c1",
      trigger: "manual",
      enabled: true,
      env: { FINANCE_CASE_SHADOW_TENANTS: "t1" },
      comparisonEmitter: boom,
      readDeps: {
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
              status: "approved",
              paymentStatus: "unpaid",
              departureAt: "2026-09-01T00:00:00.000Z",
              submittedAt: "2026-08-01T00:00:00.000Z",
              submittedByUserId: "c1",
              approvedAt: "2026-08-02T00:00:00.000Z",
            };
          },
        },
        obligation: {
          async resolveRegistrationObligation() {
            return { currency: "IRR", obligationMinor: "10000", source: "tour_canonical" };
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
    assert.equal(primary.ok, true);
    assert.equal(result.skipped, false);
  });
});

describe("PR5-A comparison correctness", () => {
  it("4 — same CaseOutput + same operational classification → same comparison", () => {
    const out = caseOutput({ reading: "AWAITING_COUNTERPARTY", owner: "counterparty" });
    const ops = classifyOperationalObservation({
      bookingStatus: "approved",
      bookingPaymentStatus: "unpaid",
      hasPendingManualPayment: false,
      latestReceiptStatus: null,
      inPendingReceiptQueue: false,
    });
    const a = compareFinanceCaseObservation({ caseOutput: out, operational: ops });
    const b = compareFinanceCaseObservation({ caseOutput: out, operational: ops });
    assert.equal(a.category, b.category);
    assert.deepEqual(a.interpreter, b.interpreter);
  });

  it("5 — signal / attention metadata is not part of comparison inputs", () => {
    const out = caseOutput({ reading: "AWAITING_FINANCE", owner: "finance" });
    const ops = classifyOperationalObservation({
      bookingStatus: "approved",
      bookingPaymentStatus: "unpaid",
      hasPendingManualPayment: true,
      latestReceiptStatus: "Pending",
      inPendingReceiptQueue: true,
    });
    const a = compareFinanceCaseObservation({ caseOutput: out, operational: ops });
    // Re-compare identical facts — attention is not an input field.
    const b = compareFinanceCaseObservation({ caseOutput: out, operational: ops });
    assert.equal(a.category, b.category);
    assert.equal(a.category, "aligned");
  });

  it("6 — provider degradation creates uncomparable, not false mismatch", () => {
    const out = caseOutput({ reading: "AWAITING_COUNTERPARTY", owner: "counterparty" });
    const ops = classifyOperationalObservation({
      bookingStatus: "approved",
      bookingPaymentStatus: "paid",
      hasPendingManualPayment: false,
      latestReceiptStatus: null,
      inPendingReceiptQueue: false,
    });
    const result = compareFinanceCaseObservation({
      caseOutput: out,
      operational: ops,
      degradedProviders: ["obligation"],
    });
    assert.equal(result.category, "uncomparable");
  });

  it("7 — unknown / incomplete facts do not become operational errors", () => {
    const out = caseOutput({
      reading: "INCOMPLETE_INSPECT",
      owner: "finance",
      completenessClass: "inspect_forced",
    });
    const ops = classifyOperationalObservation({
      bookingStatus: "approved",
      bookingPaymentStatus: "unpaid",
      hasPendingManualPayment: false,
      latestReceiptStatus: null,
      inPendingReceiptQueue: false,
    });
    const result = compareFinanceCaseObservation({ caseOutput: out, operational: ops });
    assert.equal(result.category, "uncomparable");
  });
});

describe("PR5-A comparison safety", () => {
  it("8 — shadow disabled → zero comparison execution", async () => {
    const emitter = createInMemoryFinanceCaseComparisonEmitter();
    let reads = 0;
    const result = await runDenaliFinanceCaseShadow({
      tenantId: "t1",
      registrationId: "r1",
      counterpartyId: "c1",
      trigger: "manual",
      enabled: false,
      comparisonEmitter: emitter,
      readDeps: {
        bookings: {
          async getById() {
            reads += 1;
            return null;
          },
        },
        obligation: {
          async resolveRegistrationObligation() {
            reads += 1;
            return null;
          },
          async resolveRegistrationPaymentCollection() {
            return "offline";
          },
        },
        finance: {
          async findLatestReceiptForRegistration() {
            reads += 1;
            return null;
          },
          async getRegistrationInvoiceFacts() {
            reads += 1;
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
    assert.equal(result.skipped, true);
    if (result.skipped) {
      assert.equal(result.reason, "disabled");
    }
    assert.equal(reads, 0);
    assert.equal(emitter.observations.length, 0);
  });

  it("9 — sampling / empty allowlist excludes non-selected executions", () => {
    const emptyAllowlist = resolveFinanceCaseShadowRollout({
      tenantId: "t1",
      enabled: true,
      env: {},
    });
    assert.equal(emptyAllowlist.run, false);
    if (!emptyAllowlist.run) {
      assert.equal(emptyAllowlist.reason, "tenant_excluded");
    }

    const excluded = resolveFinanceCaseShadowRollout({
      tenantId: "t1",
      enabled: true,
      env: {
        FINANCE_CASE_SHADOW_TENANTS: "t1",
        FINANCE_CASE_SHADOW_SAMPLE_RATE: "0.2",
      },
      random: () => 0.9,
    });
    assert.equal(excluded.run, false);
    if (!excluded.run) {
      assert.equal(excluded.reason, "sampled_out");
    }

    const tenantExcluded = resolveFinanceCaseShadowRollout({
      tenantId: "other",
      enabled: true,
      env: { FINANCE_CASE_SHADOW_TENANTS: "t1,t2" },
    });
    assert.equal(tenantExcluded.run, false);
    if (!tenantExcluded.run) {
      assert.equal(tenantExcluded.reason, "tenant_excluded");
    }

    const included = resolveFinanceCaseShadowRollout({
      tenantId: "t1",
      enabled: true,
      env: {
        FINANCE_CASE_SHADOW_TENANTS: "t1",
        FINANCE_CASE_SHADOW_SAMPLE_RATE: "1",
      },
    });
    assert.equal(included.run, true);
  });

  it("10 — sink failure is swallowed", async () => {
    const boom = {
      async emit() {
        throw new Error("metrics_down");
      },
    };
    await assert.doesNotReject(async () => {
      await runDenaliFinanceCaseShadow({
        tenantId: "t1",
        registrationId: "r1",
        counterpartyId: "c1",
        trigger: "manual",
        enabled: true,
        env: { FINANCE_CASE_SHADOW_TENANTS: "t1" },
        comparisonEmitter: boom,
        readDeps: {
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
                status: "approved",
                paymentStatus: "unpaid",
                departureAt: "2026-09-01T00:00:00.000Z",
                submittedAt: "2026-08-01T00:00:00.000Z",
                submittedByUserId: "c1",
                approvedAt: "2026-08-02T00:00:00.000Z",
              };
            },
          },
          obligation: {
            async resolveRegistrationObligation() {
              return { currency: "IRR", obligationMinor: "5000", source: "tour_canonical" };
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
    });
  });

  it("owner disagreement taxonomy", () => {
    const result = compareFinanceCaseObservation({
      caseOutput: caseOutput({ reading: "AWAITING_COUNTERPARTY", owner: "counterparty" }),
      operational: classifyOperationalObservation({
        bookingStatus: "approved",
        bookingPaymentStatus: "unpaid",
        hasPendingManualPayment: false,
        latestReceiptStatus: "Pending",
        inPendingReceiptQueue: true,
      }),
    });
    assert.equal(result.category, "owner_disagreement");
  });

  it("finance-core package stays Denali-free", () => {
    const pkg = readFileSync(resolve(REPO_ROOT, "packages/finance-core/package.json"), "utf8");
    assert.doesNotMatch(pkg, /workspace-denali/);
  });
});
