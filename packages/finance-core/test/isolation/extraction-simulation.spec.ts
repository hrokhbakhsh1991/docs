/**
 * Extraction simulation — finance-core runs with in-memory repo + fakes only.
 * No apps/api, Prisma, workspace packages, or env.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, it } from "node:test";

import { createFinanceService } from "../../src/application/finance.service.ts";
import type { FinanceActorContext } from "../../src/ports/finance-actor-context.ts";
import {
  FakeCapability,
  FakeAuthz,
  FakeClock,
  FakeDisplay,
  FakeLogger,
  FakeMetrics,
  FakeProof,
  FakeReceiptDefaults,
  FakeSchedules,
  FakeStorage,
  createFakeBookingPort,
  createFakeLedgerPolicy,
} from "./fakes.ts";
import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./in-memory-finance.repository.ts";

const ISO_DIR = dirname(fileURLToPath(import.meta.url));
const TENANT = "00000000-0000-4000-8000-000000000099";
const AUTH: FinanceActorContext = {
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: TENANT,
  role: "admin",
  status: "ACTIVE",
  workspaceId: "ws-isolation",
};

function assertNoAppsApiImports(): void {
  for (const rel of [
    "fakes.ts",
    "in-memory-finance.repository.ts",
    "extraction-simulation.spec.ts",
  ]) {
    const src = readFileSync(join(ISO_DIR, rel), "utf8");
    assert.doesNotMatch(src, /from ["'][^"']*apps\/api/);
    assert.doesNotMatch(src, /from ["']@apps\/api/);
    assert.doesNotMatch(src, /from ["']@app-tour\/workspace-/);
    assert.doesNotMatch(src, /from ["']@prisma\/client["']/);
    assert.doesNotMatch(src, /process\.env/);
  }
}

describe("FIN-EXTRACTION-SIM finance-core isolated environment", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
  });

  it("isolation harness has zero apps/api / prisma / workspace / env imports", () => {
    assertNoAppsApiImports();
  });

  it("1) payment flow — create manual payment via service", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const ledger = createFakeLedgerPolicy();
    const finance = createFinanceService(
      ledger,
      repo,
      booking,
      FakeReceiptDefaults,
      FakeDisplay,
      FakeMetrics,
      FakeStorage,
      FakeProof,
      FakeCapability,
      FakeAuthz,
      FakeSchedules,
      FakeLogger,
      FakeClock
    );

    const registrationId = randomUUID();
    const payment = await finance.createManualPayment(
      AUTH,
      {
        registrationId,
        amount: "2500000",
        currency: "IRR",
      },
      "idem-pay-create-1"
    );

    assert.equal(payment.status, "Pending");
    assert.equal(payment.registrationId, registrationId);
    assert.equal(payment.amount, "2500000");
    const found = await repo.findPaymentById(TENANT, payment.id);
    assert.equal(found?.id, payment.id);
  });

  it("2) prepayment flow — record + list", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const ledger = createFakeLedgerPolicy();
    const finance = createFinanceService(
      ledger,
      repo,
      booking,
      FakeReceiptDefaults,
      FakeDisplay,
      FakeMetrics,
      FakeStorage,
      FakeProof,
      FakeCapability,
      FakeAuthz,
      FakeSchedules,
      FakeLogger,
      FakeClock
    );

    const registrationId = randomUUID();
    const recorded = await finance.recordPrepayment(
      AUTH,
      {
        registrationId,
        amountMinor: "500000",
        currency: "IRR",
        method: "Manual",
      },
      "idem-prepay-1"
    );

    assert.equal(recorded.registrationId, registrationId);
    assert.equal(recorded.amountMinor, "500000");
    assert.equal(ledger.prepaymentCaptures.length, 1);

    const listed = await finance.listPrepayments(AUTH, 10, registrationId);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.amountMinor, "500000");
  });

  it("3) ledger capture request creation on approve (durable storage)", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const ledger = createFakeLedgerPolicy();
    const finance = createFinanceService(
      ledger,
      repo,
      booking,
      FakeReceiptDefaults,
      FakeDisplay,
      FakeMetrics,
      FakeStorage,
      FakeProof,
      FakeCapability,
      FakeAuthz,
      FakeSchedules,
      FakeLogger,
      FakeClock
    );

    const registrationId = randomUUID();
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId,
      amount: "2500000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    const receipt = await repo.createReceipt({
      tenantId: TENANT,
      paymentId: payment.id,
      fileKey: `receipts/${payment.id}/proof.jpg`,
    });

    const reviewed = await finance.reviewReceipt(AUTH, receipt.id, {
      decision: "approve",
      reviewNote: "ok",
    });

    assert.equal(reviewed.status, "Approved");
    assert.equal(ledger.paymentCaptures.length, 1);
    assert.equal(ledger.paymentCaptures[0]?.paymentId, payment.id);
    assert.equal(
      ledger.paymentCaptures[0]?.capturedAtIso,
      "2026-07-19T00:00:00.000Z"
    );

    const events = await repo.listLedgerEvents(TENANT, 20);
    const capture = events.find((e) => e.eventType === "finance.ledger.capture");
    assert.ok(capture, "expected finance.ledger.capture row from approve");
    assert.equal(capture.domainEventId, `payment:${payment.id}:ledger-capture-anchor`);
  });

  it("4) idempotency — payment creation key + prepayment key replay", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const ledger = createFakeLedgerPolicy();
    const finance = createFinanceService(
      ledger,
      repo,
      booking,
      FakeReceiptDefaults,
      FakeDisplay,
      FakeMetrics,
      FakeStorage,
      FakeProof,
      FakeCapability,
      FakeAuthz,
      FakeSchedules,
      FakeLogger,
      FakeClock
    );

    const registrationId = randomUUID();
    const first = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "1000", currency: "IRR" },
      "Idem-Pay-Key-A"
    );
    const second = await finance.createManualPayment(
      AUTH,
      { registrationId, amount: "1000", currency: "IRR" },
      "Idem-Pay-Key-A"
    );
    assert.equal(first.id, second.id);

    const prepay1 = await finance.recordPrepayment(
      AUTH,
      { registrationId, amountMinor: "100", currency: "IRR", method: "Manual" },
      "idem-prepay-same"
    );
    const prepay2 = await finance.recordPrepayment(
      AUTH,
      { registrationId, amountMinor: "100", currency: "IRR", method: "Manual" },
      "idem-prepay-same"
    );
    assert.equal(prepay1.id, prepay2.id);
    assert.equal(ledger.prepaymentCaptures.length, 2); // policy called twice; repo idempotent
  });

  it("5) approval workflow — Pending → Paid + booking paid + Approved", async () => {
    const booking = createFakeBookingPort();
    const repo = new InMemoryFinanceRepository(booking);
    const ledger = createFakeLedgerPolicy();
    const finance = createFinanceService(
      ledger,
      repo,
      booking,
      FakeReceiptDefaults,
      FakeDisplay,
      FakeMetrics,
      FakeStorage,
      FakeProof,
      FakeCapability,
      FakeAuthz,
      FakeSchedules,
      FakeLogger,
      FakeClock
    );

    const registrationId = randomUUID();
    const payment = await repo.createManualPayment({
      tenantId: TENANT,
      registrationId,
      amount: "2500000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    const receipt = await repo.createReceipt({
      tenantId: TENANT,
      paymentId: payment.id,
      fileKey: `receipts/${payment.id}/proof.jpg`,
    });

    const reviewed = await finance.reviewReceipt(AUTH, receipt.id, {
      decision: "approve",
    });

    assert.equal(reviewed.status, "Approved");
    assert.equal(reviewed.bookingPaymentStatus, "paid");
    assert.ok(booking.paidRegistrations.has(registrationId));

    const paid = await repo.findPaymentById(TENANT, payment.id);
    assert.equal(paid?.status, "Paid");
    const approved = await repo.findReceiptById(TENANT, receipt.id);
    assert.equal(approved?.status, "Approved");

    // Idempotent approve replay
    const replay = await finance.reviewReceipt(AUTH, receipt.id, {
      decision: "approve",
    });
    assert.equal(replay.status, "Approved");
  });
});
