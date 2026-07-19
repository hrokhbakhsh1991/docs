/**
 * INV — Paid ⇒ exactly one durable ledger capture (fail-closed empty lines / prepay enqueue).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import { createFinanceService } from "../src/application/finance.service.ts";
import type { FinanceActorContext } from "../src/ports/finance-actor-context.ts";
import type { FinanceLedgerCapturePlan, FinanceLedgerPolicyPort } from "../src/ports/finance-ledger-policy.port.ts";
import {
  FakeAuthz,
  FakeCapability,
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
} from "./isolation/fakes.ts";
import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./isolation/in-memory-finance.repository.ts";

const TENANT = "00000000-0000-4000-8000-0000000000c1";
const AUTH: FinanceActorContext = {
  userId: "00000000-0000-4000-8000-0000000000c2",
  tenantId: TENANT,
  role: "admin",
  status: "ACTIVE",
  workspaceId: "ws-ledger-inv",
};

function emptyLedgerPolicy(): FinanceLedgerPolicyPort {
  return {
    buildPaymentCaptureJournal(): FinanceLedgerCapturePlan {
      return {
        journalId: "journal:empty",
        domainEventId: "payment:empty:ledger-capture-anchor",
        lines: [],
      };
    },
    buildPrepaymentJournal(): FinanceLedgerCapturePlan {
      return {
        journalId: "journal:empty-prepay",
        domainEventId: "prepayment:empty:ledger",
        lines: [],
      };
    },
  };
}

function createService(ledger: FinanceLedgerPolicyPort = createFakeLedgerPolicy()) {
  const booking = createFakeBookingPort();
  const repo = new InMemoryFinanceRepository(booking);
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
  return { finance, repo, booking };
}

async function seedPendingReceipt(repo: InMemoryFinanceRepository): Promise<{
  readonly paymentId: string;
  readonly receiptId: string;
  readonly registrationId: string;
}> {
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
  return { paymentId: payment.id, receiptId: receipt.id, registrationId };
}

function countPaymentCaptures(
  events: readonly { eventType: string; domainEventId: string | null }[],
  paymentId: string
): number {
  const anchor = `payment:${paymentId}:ledger-capture-anchor`;
  return events.filter(
    (e) => e.eventType === "finance.ledger.capture" && e.domainEventId === anchor
  ).length;
}

describe("INV-LEDGER Paid ⇒ exactly one durable capture", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
  });

  it("INV-P1 empty lines refuse approve — payment stays Pending", async () => {
    const { finance, repo } = createService(emptyLedgerPolicy());
    const seeded = await seedPendingReceipt(repo);
    await assert.rejects(
      () =>
        finance.reviewReceipt(AUTH, seeded.receiptId, {
          decision: "approve",
        }),
      /FINANCE_LEDGER_CAPTURE_EMPTY/
    );
    const payment = await repo.findPaymentById(TENANT, seeded.paymentId);
    const receipt = await repo.findReceiptById(TENANT, seeded.receiptId);
    assert.equal(payment?.status, "Pending");
    assert.equal(receipt?.status, "Pending");
    assert.equal(countPaymentCaptures(await repo.listLedgerEvents(TENANT, 50), seeded.paymentId), 0);
  });

  it("INV-P2 successful approve ⇒ exactly one capture", async () => {
    const { finance, repo } = createService();
    const seeded = await seedPendingReceipt(repo);
    const reviewed = await finance.reviewReceipt(AUTH, seeded.receiptId, {
      decision: "approve",
    });
    assert.equal(reviewed.status, "Approved");
    const payment = await repo.findPaymentById(TENANT, seeded.paymentId);
    assert.equal(payment?.status, "Paid");
    assert.equal(countPaymentCaptures(await repo.listLedgerEvents(TENANT, 50), seeded.paymentId), 1);
  });

  it("INV-P3 repeated approve / replay ⇒ still exactly one capture", async () => {
    const { finance, repo } = createService();
    const seeded = await seedPendingReceipt(repo);
    await finance.reviewReceipt(AUTH, seeded.receiptId, { decision: "approve" });
    const replay = await finance.reviewReceipt(AUTH, seeded.receiptId, {
      decision: "approve",
    });
    assert.equal(replay.status, "Approved");
    assert.equal(countPaymentCaptures(await repo.listLedgerEvents(TENANT, 50), seeded.paymentId), 1);
  });

  it("INV-P4 empty lines refuse prepayment — no recorded event", async () => {
    const { finance, repo } = createService(emptyLedgerPolicy());
    const registrationId = randomUUID();
    await assert.rejects(
      () =>
        finance.recordPrepayment(
          AUTH,
          {
            registrationId,
            amountMinor: "100000",
            currency: "IRR",
            method: "Manual",
          },
          `prepay-empty-${registrationId}`
        ),
      /FINANCE_LEDGER_CAPTURE_EMPTY/
    );
    const listed = await finance.listPrepayments(AUTH, 20, registrationId);
    assert.equal(listed.length, 0);
    const events = await repo.listLedgerEvents(TENANT, 50);
    assert.equal(
      events.filter((e) => e.eventType === "finance.prepayment.recorded").length,
      0
    );
  });

  it("INV-P5 prepay enqueue conflict — memory refuses empty before write; duplicate key replays once", async () => {
    const { finance, repo } = createService();
    const registrationId = randomUUID();
    const key = `prepay-idem-${registrationId}`;
    const first = await finance.recordPrepayment(
      AUTH,
      {
        registrationId,
        amountMinor: "100000",
        currency: "IRR",
        method: "Manual",
      },
      key
    );
    const second = await finance.recordPrepayment(
      AUTH,
      {
        registrationId,
        amountMinor: "100000",
        currency: "IRR",
        method: "Manual",
      },
      key
    );
    assert.equal(second.id, first.id);
    const events = await repo.listLedgerEvents(TENANT, 50);
    const ledgerRows = events.filter(
      (e) =>
        e.eventType === "finance.ledger.capture" &&
        typeof e.domainEventId === "string" &&
        e.domainEventId.includes(registrationId)
    );
    assert.equal(ledgerRows.length, 1);
    assert.equal(
      events.filter((e) => e.eventType === "finance.prepayment.recorded").length,
      1
    );
  });
});
