/**
 * Phase 1.3 — same FinanceService engine under Denali and finance-ws2 policies.
 * Does not change FinanceService; only injects registry-resolved ports.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import {
  getBookingsRepository,
  resetBookingsRepositoryForTests,
} from "../bookings/create-bookings-repository.ts";
import { OPERATOR_SMOKE } from "../../test/fixtures/operator-smoke-e2e-tenant.ts";
import {
  resolveFinanceLedgerPolicy,
  resolveFinanceReceiptDefaults,
} from "./finance-dependency-registry.ts";
import { createFinanceService, FinanceService } from "./finance.service.ts";
import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter.ts";
import { BookingRegistrationDisplayAdapter } from "./infrastructure/booking-registration-display.adapter.ts";
import {
  FINANCE_WS2_LEDGER_ACCOUNTS,
  FINANCE_WS2_WORKSPACE_TYPE,
  financeWs2BookingWalletId,
} from "@app-tour/workspace-finance-ws2";
import { DenaliFinanceLedgerPolicyAdapter } from "@app-tour/workspace-denali";
import { FinanceWs2LedgerPolicyAdapter } from "@app-tour/workspace-finance-ws2";
import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./in-memory-finance.repository.ts";
import {
  fakeEmptySchedules,
  fakeMemoryPersistenceMode,
  fakeFixedClock,
  fakeNoopLog,
  fakeNoopMetrics,
  fakePermissiveCapability,
  fakePermissiveAccess,
  fakeReceiptProofUrl,
} from "./finance-service-host-fakes.ts";

const FINANCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = resolve(FINANCE_ROOT, "../../../../");
const DENALI = "denali";
const WS2 = FINANCE_WS2_WORKSPACE_TYPE;

describe("finance-ws2-engine.spec.ts — Phase 1.3 dual policy", { concurrency: false }, () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorDatabaseUrl = process.env.DATABASE_URL;

  const operatorAuth: TenantAuthContext = {
    userId: OPERATOR_SMOKE.adminUserId,
    tenantId: OPERATOR_SMOKE.tenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-finance-ws2",
  };

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
    if (priorDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = priorDatabaseUrl;
    }
  });

  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
    resetBookingsRepositoryForTests();
  });

  async function createEngine(workspaceType: string): Promise<{
    finance: FinanceService;
    financeRepo: InMemoryFinanceRepository;
  }> {
    const bookingPayments = new BookingPaymentAdapter(getBookingsRepository());
    const financeRepo = new InMemoryFinanceRepository(bookingPayments);
    const finance = createFinanceService(
      await resolveFinanceLedgerPolicy(workspaceType),
      financeRepo,
      bookingPayments,
      await resolveFinanceReceiptDefaults(workspaceType),
      new BookingRegistrationDisplayAdapter(getBookingsRepository()),
      fakeNoopMetrics,
      fakeMemoryPersistenceMode,
      fakeReceiptProofUrl,
      fakePermissiveCapability,
      fakePermissiveAccess,
      fakeEmptySchedules,
      fakeNoopLog,
      fakeFixedClock
    );
    return { finance, financeRepo };
  }

  function seedBooking(registrationId: string): void {
    getBookingsRepository().seedBooking({
      id: registrationId,
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: OPERATOR_SMOKE.seedTourId,
      tourTitle: "WS2 Finance Tour",
      guestLabel: "WS2 Guest",
      guestEmail: null,
      guestPhone: null,
      partySize: 1,
      status: "pending",
      paymentStatus: "unpaid",
      departureAt: "2026-08-01T00:00:00.000Z",
      submittedAt: "2026-07-01T00:00:00.000Z",
      submittedByUserId: OPERATOR_SMOKE.memberUserId,
      approvedAt: null,
    });
  }

  it("FIN-P1.3-01 / P1.10 no-copy architecture: one FinanceService; WS2 lives in workspace package", () => {
    const serviceSrc = readFileSync(
      resolve(FINANCE_ROOT, "../../../../packages/finance-core/src/application/finance.service.ts"),
      "utf8"
    );
    assert.doesNotMatch(
      serviceSrc,
      /FinanceWs2|finance-ws2-chart|finance-ws2-ledger|finance-ws2-receipt/
    );
    assert.doesNotMatch(
      serviceSrc,
      /DenaliFinanceLedgerPolicyAdapter|DenaliFinanceReceiptDefaultsAdapter/
    );
    assert.doesNotMatch(serviceSrc, /finance-dependency-registry/);

    const topLevel = readdirSync(FINANCE_ROOT);
    assert.ok(!topLevel.includes("finance-ws2.service.ts"));
    assert.ok(!topLevel.includes("finance-ws2.repository.ts"));
    assert.equal(topLevel.filter((name) => /^finance\.service/.test(name)).length, 2); // .ts + .spec.ts

    const infra = readdirSync(resolve(FINANCE_ROOT, "infrastructure"));
    assert.deepEqual(
      [...infra].filter((n) => n.endsWith(".ts")).sort(),
      [
        "booking-payment.adapter.ts",
        "booking-registration-display.adapter.ts",
        "host-commercial-quote.repository.ts",
        "host-finance-access.adapter.ts",
        "host-finance-capability.adapter.ts",
        "host-finance-clock.adapter.ts",
        "host-finance-log.adapter.ts",
        "host-finance-metrics.adapter.ts",
        "host-finance-persistence-mode.adapter.ts",
        "host-finance-receipt-proof-url.adapter.ts",
        "host-finance-schedule.adapter.ts",
        "identity-membership-discount-read.adapter.ts",
        "prisma-commercial-quote.repository.ts",
        "prisma-finance.repository.ts",
        "prisma-workspace-outbox-writer.ts",
        "read-tour-membership-discount-gate.ts",
        "registration-commercial-quote-freeze-context.adapter.ts",
        "registration-finance-obligation.adapter.ts",
      ].sort()
    );

    const depRegistry = readFileSync(
      resolve(FINANCE_ROOT, "finance-dependency-registry.ts"),
      "utf8"
    );
    assert.match(depRegistry, /workspace-finance-dependency-bindings\.generated/);
    assert.doesNotMatch(
      depRegistry,
      /DenaliFinanceLedgerPolicyAdapter|FinanceWs2LedgerPolicyAdapter/
    );
  });

  it("FIN-P1.3-02 / P1.10 WS2 modules live in workspace package without Denali imports", () => {
    const ws2Root = resolve(REPO_ROOT, "packages/workspaces/finance-ws2/src/finance");
    const ws2Files = [
      "chart-of-accounts.ts",
      "ledger-policy.adapter.ts",
      "receipt-defaults.adapter.ts",
    ].map((rel) => resolve(ws2Root, rel));

    for (const file of ws2Files) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /@app-tour\/workspace-denali/);
      assert.doesNotMatch(src, /DenaliFinance/);
      assert.doesNotMatch(src, /from ["'].*denali-finance/);
    }
  });

  it("FIN-P1.3-03 policy selection: denali vs finance-ws2 via registry only", async () => {
    const denali = await resolveFinanceLedgerPolicy(DENALI);
    const ws2 = await resolveFinanceLedgerPolicy(WS2);
    assert.ok(denali instanceof DenaliFinanceLedgerPolicyAdapter);
    assert.ok(ws2 instanceof FinanceWs2LedgerPolicyAdapter);
    assert.notEqual(denali.constructor, ws2.constructor);
  });

  it("FIN-P1.3-04 defaults selection: IRR/Denali vs USD/WS2", async () => {
    assert.deepEqual(
      (await resolveFinanceReceiptDefaults(DENALI)).offlineReceiptPaymentDefaults(),
      {
        amountMinor: "2500000",
        currency: "IRR",
      }
    );
    assert.deepEqual((await resolveFinanceReceiptDefaults(WS2)).offlineReceiptPaymentDefaults(), {
      amountMinor: "10000",
      currency: "USD",
    });
  });

  it("FIN-P1.3-05 same engine + Denali policy: approve raises booking paid", async () => {
    const registrationId = randomUUID();
    seedBooking(registrationId);
    const { finance, financeRepo } = await createEngine(DENALI);
    const payment = await financeRepo.createManualPayment({
      tenantId: OPERATOR_SMOKE.tenantId,
      registrationId,
      amount: "2500000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    const receipt = await financeRepo.createReceipt({
      tenantId: OPERATOR_SMOKE.tenantId,
      paymentId: payment.id,
      fileKey: `receipts/${payment.id}/denali-proof.jpg`,
    });

    const reviewed = await finance.reviewReceipt(operatorAuth, receipt.id, {
      decision: "approve",
    });
    assert.equal(reviewed.status, "Approved");
    assert.equal(reviewed.bookingPaymentStatus, "paid");

    const denaliPlan = (await resolveFinanceLedgerPolicy(DENALI)).buildPaymentCaptureJournal({
      tenantId: OPERATOR_SMOKE.tenantId,
      paymentId: payment.id,
      registrationId,
      amountMinor: "2500000",
      currency: "IRR",
      capturedAtIso: "2026-07-18T00:00:00.000Z",
    });
    assert.ok(
      denaliPlan.lines.some((l) => l.account === "gl:leader-registration-payment-clearing")
    );
    assert.ok(denaliPlan.lines.some((l) => l.account === `booking:${registrationId}`));
  });

  it("FIN-P1.3-06 same engine + finance-ws2 policy: approve + WS2 CoA", async () => {
    const registrationId = randomUUID();
    seedBooking(registrationId);
    const { finance, financeRepo } = await createEngine(WS2);

    const payment = await financeRepo.createManualPayment({
      tenantId: OPERATOR_SMOKE.tenantId,
      registrationId,
      amount: "10000",
      currency: "USD",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    const receipt = await financeRepo.createReceipt({
      tenantId: OPERATOR_SMOKE.tenantId,
      paymentId: payment.id,
      fileKey: `receipts/${payment.id}/ws2-proof.jpg`,
    });

    const reviewed = await finance.reviewReceipt(operatorAuth, receipt.id, {
      decision: "approve",
    });
    assert.equal(reviewed.status, "Approved");
    assert.equal(reviewed.bookingPaymentStatus, "paid");

    const ws2Plan = (await resolveFinanceLedgerPolicy(WS2)).buildPaymentCaptureJournal({
      tenantId: OPERATOR_SMOKE.tenantId,
      paymentId: payment.id,
      registrationId,
      amountMinor: "10000",
      currency: "USD",
      capturedAtIso: "2026-07-18T00:00:00.000Z",
    });
    const accounts = ws2Plan.lines.map((l) => l.account);
    assert.ok(accounts.includes(FINANCE_WS2_LEDGER_ACCOUNTS.OPERATOR_CASH_CLEARING));
    assert.ok(accounts.includes(financeWs2BookingWalletId(registrationId)));
    assert.ok(!accounts.includes("gl:leader-registration-payment-clearing"));
    assert.ok(!accounts.includes(`booking:${registrationId}`));
  });
});
