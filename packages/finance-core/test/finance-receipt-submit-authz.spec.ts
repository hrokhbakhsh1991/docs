/**
 * Hostile authz — POST /finance/receipts membership ownership (finance-core).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import { createFinanceService } from "../src/application/finance.service.ts";
import type { FinanceActorContext } from "../src/ports/finance-actor-context.ts";
import type { IBookingPaymentPort } from "../src/ports/booking-payment.port.ts";
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
  createFakeLedgerPolicy,
} from "./isolation/fakes.ts";
import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./isolation/in-memory-finance.repository.ts";

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const TENANT_B = "00000000-0000-4000-8000-0000000000bb";
const OWNER_USER = "00000000-0000-4000-8000-000000000001";
const STRANGER_USER = "00000000-0000-4000-8000-000000000002";

function memberAuth(userId: string, tenantId: string): FinanceActorContext {
  return {
    userId,
    tenantId,
    role: "member",
    status: "ACTIVE",
    workspaceId: "ws-authz",
  };
}

function adminAuth(tenantId: string): FinanceActorContext {
  return {
    userId: "00000000-0000-4000-8000-000000000099",
    tenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-authz",
  };
}

function createOwnershipBookingPort(owners: Map<string, string>): IBookingPaymentPort {
  return {
    async syncStatus(input) {
      return input.paymentStatus;
    },
    async raisePaidInTx(_tx, _input) {
      return "paid";
    },
    async memberOwnsRegistration(input) {
      if (input.tenantId !== TENANT_A && input.tenantId !== TENANT_B) {
        return false;
      }
      return owners.get(`${input.tenantId}:${input.registrationId}`) === input.userId;
    },
    async getPaymentStatus() {
      return "unpaid";
    },
    async getRegistrationLifecycleStatus() {
      return "approved";
    },
  };
}

describe("FIN-AUTHZ-RECEIPT submitReceipt ownership", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
  });

  it("positive — member submits receipt for own registration payment", async () => {
    const registrationId = randomUUID();
    const owners = new Map([[`${TENANT_A}:${registrationId}`, OWNER_USER]]);
    const booking = createOwnershipBookingPort(owners);
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createFinanceService(
      createFakeLedgerPolicy(),
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

    const payment = await repo.createManualPayment({
      tenantId: TENANT_A,
      registrationId,
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });

    const receipt = await finance.submitReceipt(
      memberAuth(OWNER_USER, TENANT_A),
      { paymentId: payment.id, fileKey: `receipts/${TENANT_A}/${registrationId}/ok.pdf` },
      "idem-own-1"
    );
    assert.equal(receipt.paymentId, payment.id);
    assert.equal(receipt.status, "Pending");
  });

  it("positive — member may submit text-only receipt evidence", async () => {
    const registrationId = randomUUID();
    const owners = new Map([[`${TENANT_A}:${registrationId}`, OWNER_USER]]);
    const booking = createOwnershipBookingPort(owners);
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createFinanceService(
      createFakeLedgerPolicy(),
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

    const payment = await repo.createManualPayment({
      tenantId: TENANT_A,
      registrationId,
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });

    const receipt = await finance.submitReceipt(
      memberAuth(OWNER_USER, TENANT_A),
      { paymentId: payment.id, fileKey: null, note: "پرداخت با کارت به کارت انجام شد" },
      "idem-text-only-1"
    );
    assert.equal(receipt.fileKey, null);
    assert.equal(receipt.note, "پرداخت با کارت به کارت انجام شد");
    assert.equal(receipt.status, "Pending");
  });

  it("positive — operator can approve text-only receipt and run payment side effects", async () => {
    const registrationId = randomUUID();
    const owners = new Map([[`${TENANT_A}:${registrationId}`, OWNER_USER]]);
    const booking = createOwnershipBookingPort(owners);
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createFinanceService(
      createFakeLedgerPolicy(),
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
    const payment = await repo.createManualPayment({
      tenantId: TENANT_A,
      registrationId,
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    const receipt = await finance.submitReceipt(
      memberAuth(OWNER_USER, TENANT_A),
      { paymentId: payment.id, fileKey: null, note: "کد پیگیری ۱۲۳" },
      "idem-text-approve"
    );

    const reviewed = await finance.reviewReceipt(adminAuth(TENANT_A), receipt.id, {
      decision: "approve",
    });
    const stored = await repo.findReceiptById(TENANT_A, receipt.id);
    const paid = await repo.findPaymentById(TENANT_A, payment.id);
    assert.equal(reviewed.status, "Approved");
    assert.equal(stored?.status, "Approved");
    assert.equal(paid?.status, "Paid");
    assert.ok(stored?.ledgerJournalId);
  });

  it("positive — operator can reject text-only receipt and persist review note", async () => {
    const registrationId = randomUUID();
    const owners = new Map([[`${TENANT_A}:${registrationId}`, OWNER_USER]]);
    const booking = createOwnershipBookingPort(owners);
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createFinanceService(
      createFakeLedgerPolicy(),
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
    const payment = await repo.createManualPayment({
      tenantId: TENANT_A,
      registrationId,
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    const receipt = await finance.submitReceipt(
      memberAuth(OWNER_USER, TENANT_A),
      { paymentId: payment.id, fileKey: null, note: "شرح پرداخت" },
      "idem-text-reject"
    );

    const reviewed = await finance.reviewReceipt(adminAuth(TENANT_A), receipt.id, {
      decision: "reject",
      reviewNote: "اطلاعات کافی نیست",
    });
    const stored = await repo.findReceiptById(TENANT_A, receipt.id);
    const unchangedPayment = await repo.findPaymentById(TENANT_A, payment.id);
    assert.equal(reviewed.status, "Rejected");
    assert.equal(stored?.status, "Rejected");
    assert.equal(stored?.reviewNote, "اطلاعات کافی نیست");
    assert.equal(unchangedPayment?.status, "Pending");
  });

  it("negative — idempotency key rejects a changed receipt payload", async () => {
    const registrationId = randomUUID();
    const owners = new Map([[`${TENANT_A}:${registrationId}`, OWNER_USER]]);
    const booking = createOwnershipBookingPort(owners);
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createFinanceService(
      createFakeLedgerPolicy(),
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
    const payment = await repo.createManualPayment({
      tenantId: TENANT_A,
      registrationId,
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    const fileKey = `receipts/${TENANT_A}/${registrationId}/same.pdf`;
    await finance.submitReceipt(
      memberAuth(OWNER_USER, TENANT_A),
      { paymentId: payment.id, fileKey },
      "idem-payload-mismatch"
    );

    await assert.rejects(
      () =>
        finance.submitReceipt(
          memberAuth(OWNER_USER, TENANT_A),
          { paymentId: payment.id, fileKey, note: "توضیح جدید" },
          "idem-payload-mismatch"
        ),
      (error: unknown) =>
        error instanceof Error && error.message === "FINANCE_RECEIPT_IDEMPOTENCY_CONFLICT"
    );
  });

  it("negative IDOR — member cannot submit for another user’s paymentId", async () => {
    const registrationId = randomUUID();
    const owners = new Map([[`${TENANT_A}:${registrationId}`, OWNER_USER]]);
    const booking = createOwnershipBookingPort(owners);
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createFinanceService(
      createFakeLedgerPolicy(),
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

    const payment = await repo.createManualPayment({
      tenantId: TENANT_A,
      registrationId,
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });

    await assert.rejects(
      () =>
        finance.submitReceipt(
          memberAuth(STRANGER_USER, TENANT_A),
          { paymentId: payment.id, fileKey: `receipts/${TENANT_A}/stolen.pdf` },
          "idem-idor-1"
        ),
      (err: unknown) => err instanceof Error && err.message === "BOOKINGS_FORBIDDEN"
    );
  });

  it("cross-tenant — paymentId from tenant A invisible under tenant B", async () => {
    const registrationId = randomUUID();
    const owners = new Map([[`${TENANT_A}:${registrationId}`, OWNER_USER]]);
    const booking = createOwnershipBookingPort(owners);
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createFinanceService(
      createFakeLedgerPolicy(),
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

    const payment = await repo.createManualPayment({
      tenantId: TENANT_A,
      registrationId,
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });

    await assert.rejects(
      () =>
        finance.submitReceipt(
          memberAuth(OWNER_USER, TENANT_B),
          { paymentId: payment.id, fileKey: `receipts/${TENANT_B}/x.pdf` },
          "idem-xtenant-1"
        ),
      (err: unknown) => err instanceof Error && err.message === "FINANCE_PAYMENT_NOT_FOUND"
    );
  });

  it("admin may submit without registration ownership", async () => {
    const registrationId = randomUUID();
    const booking = createOwnershipBookingPort(new Map());
    const repo = new InMemoryFinanceRepository(booking);
    const finance = createFinanceService(
      createFakeLedgerPolicy(),
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

    const payment = await repo.createManualPayment({
      tenantId: TENANT_A,
      registrationId,
      amount: "1000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });

    const receipt = await finance.submitReceipt(
      adminAuth(TENANT_A),
      { paymentId: payment.id, fileKey: `receipts/${payment.id}/ops.pdf` },
      "idem-admin-1"
    );
    assert.equal(receipt.status, "Pending");
  });
});
