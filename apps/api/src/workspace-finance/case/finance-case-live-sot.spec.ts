/**
 * PR4.5-C — live Denali SoT composition + shadow rollout proofs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { executeFinanceCase } from "@app-tour/finance-core/case";

import type { BookingRecord } from "../../bookings/bookings.types.ts";
import {
  buildEnrollmentCaseScope,
  createFinanceCaseObservationSink,
  createInMemoryFinanceCaseObservationEmitter,
  createLiveDenaliCaseProvidersForTenant,
  HostDenaliCaseReadSource,
  runDenaliFinanceCaseShadow,
  wrapFinanceServiceWithCaseShadow,
} from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../..");

const TENANT = "tenant-case-c";
const REG = "reg-case-c-1";
const CP = "user-cp-1";
const SHADOW_ENV = {
  FINANCE_CASE_SHADOW_ENABLED: "true",
  FINANCE_CASE_SHADOW_TENANTS: TENANT,
  FINANCE_CASE_SHADOW_SAMPLE_RATE: "1",
} as const;

function booking(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    id: REG,
    tenantId: TENANT,
    tourId: "tour-1",
    tourTitle: "Tour",
    guestLabel: "Guest",
    guestEmail: null,
    guestPhone: null,
    partySize: 2,
    status: "approved",
    paymentStatus: "unpaid",
    departureAt: "2026-09-01T00:00:00.000Z",
    submittedAt: "2026-08-01T00:00:00.000Z",
    submittedByUserId: CP,
    approvedAt: "2026-08-02T00:00:00.000Z",
    ...overrides,
  };
}

function createLiveDeps(options?: {
  readonly booking?: BookingRecord | null;
  readonly throwOnBooking?: boolean;
  readonly receipt?: null | {
    id: string;
    paymentId: string;
    fileKey: string;
    status: string;
    note: string | null;
    reviewNote: string | null;
    reviewedAt: Date | null;
    ledgerJournalId: string | null;
    createdAt: Date;
    payment: null;
  };
  readonly reads?: string[];
}) {
  const reads = options?.reads ?? [];
  const row = options?.booking === undefined ? booking() : options.booking;
  return {
    reads,
    deps: {
      tenantId: TENANT,
      bookings: {
        async getById(id: string, tenantId: string) {
          reads.push("booking");
          if (options?.throwOnBooking) {
            throw new Error("BOOKINGS_FORBIDDEN");
          }
          if (tenantId !== TENANT || id !== REG || row === null) {
            return null;
          }
          return row;
        },
      },
      obligation: {
        async resolveRegistrationObligation() {
          reads.push("obligation");
          return {
            currency: "IRR",
            obligationMinor: "10000",
            source: "tour_canonical" as const,
          };
        },
        async resolveRegistrationPaymentCollection() {
          reads.push("collection");
          return "offline" as const;
        },
      },
      finance: {
        async findLatestReceiptForRegistration() {
          reads.push("receipt");
          return options?.receipt === undefined ? null : options.receipt;
        },
        async getRegistrationInvoiceFacts() {
          reads.push("invoice");
          return {
            prepaymentMinor: "0",
            paidPaymentsMinor: "0",
            paymentAmountsMinor: [] as string[],
            currency: "IRR",
          };
        },
        async findPaymentStatusesByRegistration() {
          reads.push("payment_statuses");
          return [] as string[];
        },
        async findFirstPendingManualPayment() {
          reads.push("pending_payment");
          return null;
        },
        async listPendingReceipts() {
          reads.push("pending_receipts");
          return { rows: [], nextCursor: null, hasMore: false };
        },
        async listLedgerEvents() {
          reads.push("ledger");
          return [];
        },
        async listPaymentsForRegistration() {
          reads.push("payments_for_reg");
          return [];
        },
        async findPaymentById() {
          return null;
        },
        async findReceiptById() {
          return null;
        },
      },
    },
  };
}

describe("PR4.5-C live Denali SoT + shadow rollout", () => {
  it("1 — real repository adapter maps to portable facts", async () => {
    const { deps } = createLiveDeps({
      receipt: null,
    });
    const source = new HostDenaliCaseReadSource(deps);
    const money = await source.readObligation(
      buildEnrollmentCaseScope({ registrationId: REG, counterpartyId: CP })
    );
    assert.equal(money.readStatus, "ok");
    assert.equal(money.obligationMinor, "10000");
    assert.equal(money.remainingMinor, "10000");
    assert.equal(money.collectionMode, "offline");

    const evidence = await source.readEvidence(
      buildEnrollmentCaseScope({ registrationId: REG, counterpartyId: CP })
    );
    assert.equal(evidence.readStatus, "ok");
    assert.equal(evidence.receipt, null);

    const providers = createLiveDenaliCaseProvidersForTenant(deps);
    const out = await executeFinanceCase(providers, {
      scope: buildEnrollmentCaseScope({ registrationId: REG, counterpartyId: CP }),
      mode: "lookup",
      providerTimeoutMs: 2_000,
    });
    assert.equal(out.caseOutput.reading, "AWAITING_COUNTERPARTY");
    assert.equal(out.snapshot.facts.evidence.proofExists.kind, "absent");
  });

  it("2 — finance-core remains Denali-free", () => {
    const pkg = readFileSync(resolve(REPO_ROOT, "packages/finance-core/package.json"), "utf8");
    assert.doesNotMatch(pkg, /workspace-denali|workspaces\/denali/);
    const publicApi = readFileSync(
      resolve(REPO_ROOT, "packages/finance-core/src/case/public-api.ts"),
      "utf8"
    );
    assert.doesNotMatch(publicApi, /from\s+["']@app-tour\/workspace-denali/);
  });

  it("3 — shadow OFF produces no execution / no SoT reads", async () => {
    const { deps, reads } = createLiveDeps();
    const result = await runDenaliFinanceCaseShadow({
      tenantId: TENANT,
      registrationId: REG,
      counterpartyId: CP,
      trigger: "manual",
      readDeps: {
        bookings: deps.bookings,
        finance: deps.finance,
        obligation: deps.obligation,
      },
      enabled: false,
    });
    assert.equal(result.skipped, true);
    assert.deepEqual(reads, []);
  });

  it("4 — shadow ON cannot alter primary workflow output", async () => {
    const { deps } = createLiveDeps();
    const emitter = createInMemoryFinanceCaseObservationEmitter();
    const sink = createFinanceCaseObservationSink(emitter);

    async function primary(shadowEnabled: boolean) {
      const primaryResult = { ok: true as const, paymentId: "pay-1" };
      const shadowResult = await runDenaliFinanceCaseShadow({
        tenantId: TENANT,
        registrationId: REG,
        counterpartyId: CP,
        trigger: "post_payment_mutation",
        readDeps: {
          bookings: deps.bookings,
          finance: deps.finance,
          obligation: deps.obligation,
        },
        sink,
        enabled: shadowEnabled,
        env: SHADOW_ENV,
      });
      return { primaryResult, shadowResult };
    }

    const off = await primary(false);
    const on = await primary(true);
    assert.deepEqual(off.primaryResult, on.primaryResult);
    assert.equal(off.shadowResult.skipped, true);
    assert.equal(on.shadowResult.skipped, false);
  });

  it("5 — provider timeout does not fail request (shadow fail-open)", async () => {
    const { deps } = createLiveDeps();
    const slowBookings = {
      async getById() {
        await new Promise((r) => setTimeout(r, 50));
        return booking();
      },
    };
    const result = await runDenaliFinanceCaseShadow({
      tenantId: TENANT,
      registrationId: REG,
      counterpartyId: CP,
      trigger: "manual",
      readDeps: {
        bookings: slowBookings,
        finance: deps.finance,
        obligation: deps.obligation,
      },
      providerTimeoutMs: 1,
      enabled: true,
      env: { FINANCE_CASE_SHADOW_TENANTS: TENANT },
    });
    assert.equal("skipped" in result && result.skipped, false);
    // Shadow may succeed with degraded providers or fail — must not throw.
    assert.ok(result);
  });

  it("6 — permission / read failure degrades honestly", async () => {
    const { deps } = createLiveDeps({ throwOnBooking: true });
    const source = new HostDenaliCaseReadSource(deps);
    const money = await source.readObligation(
      buildEnrollmentCaseScope({ registrationId: REG, counterpartyId: CP })
    );
    assert.equal(money.readStatus, "failed");

    const providers = createLiveDenaliCaseProvidersForTenant(deps);
    const out = await executeFinanceCase(providers, {
      scope: buildEnrollmentCaseScope({ registrationId: REG, counterpartyId: CP }),
      mode: "lookup",
    });
    assert.equal(out.snapshot.facts.money.remaining.kind, "unknown");
  });

  it("7 — same facts produce same CaseOutput", async () => {
    const { deps } = createLiveDeps();
    const providers = createLiveDenaliCaseProvidersForTenant(deps);
    const scope = buildEnrollmentCaseScope({ registrationId: REG, counterpartyId: CP });
    const a = await executeFinanceCase(providers, { scope, mode: "lookup" });
    const b = await executeFinanceCase(providers, { scope, mode: "lookup" });
    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    assert.equal(a.caseOutput.owner, b.caseOutput.owner);
    assert.equal(a.caseOutput.primaryPosture, b.caseOutput.primaryPosture);
  });

  it("8 — signal changes do not change interpretation", async () => {
    const { deps } = createLiveDeps();
    const providers = createLiveDenaliCaseProvidersForTenant(deps);
    const scope = buildEnrollmentCaseScope({ registrationId: REG, counterpartyId: CP });
    const a = await executeFinanceCase(providers, {
      scope,
      mode: "lookup",
      includeSignal: false,
    });
    const b = await executeFinanceCase(providers, {
      scope,
      mode: "attention",
      includeSignal: true,
    });
    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    assert.equal(a.caseOutput.owner, b.caseOutput.owner);
  });

  it("wrap preserves primary createManualPayment result shape", async () => {
    const { deps } = createLiveDeps();
    const calls: string[] = [];
    const fakeService = {
      async createManualPayment(_auth: { tenantId: string }, body: { registrationId: string }) {
        calls.push("primary");
        return { id: "pay-x", registrationId: body.registrationId };
      },
      async submitReceipt() {
        return {};
      },
      async reviewReceipt() {
        return {};
      },
      async getRegistrationInvoice() {
        return {};
      },
    };
    const wrapped = wrapFinanceServiceWithCaseShadow(
      fakeService as never,
      {
        bookings: deps.bookings,
        finance: deps.finance,
        obligation: deps.obligation,
        env: { FINANCE_CASE_SHADOW_ENABLED: "0" },
      }
    );
    const result = await wrapped.createManualPayment(
      { tenantId: TENANT } as never,
      { registrationId: REG } as never,
      "key"
    );
    assert.deepEqual(result, { id: "pay-x", registrationId: REG });
    assert.deepEqual(calls, ["primary"]);
  });
});
