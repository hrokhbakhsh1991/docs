/**
 * Unit tests — receipt approve ↔ booking payment projection (fail-closed).
 * Memory finance + in-memory bookings; no Postgres required.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import {
  getBookingsRepository,
  resetBookingsRepositoryForTests,
} from "../bookings/create-bookings-repository.ts";
import { OPERATOR_SMOKE } from "../../test/fixtures/operator-smoke-e2e-tenant.ts";
import { FinanceService } from "./finance.service.ts";
import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter.ts";
import { DenaliFinanceLedgerPolicyAdapter } from "./infrastructure/denali-finance-ledger-policy.adapter.ts";
import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./in-memory-finance.repository.ts";
import type {
  BookingPaymentSyncStatusInput,
  IBookingPaymentPort,
} from "./ports/booking-payment.port.ts";

describe("finance.service.spec.ts — reviewReceipt booking sync", { concurrency: false }, () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorDatabaseUrl = process.env.DATABASE_URL;

  const operatorAuth: TenantAuthContext = {
    userId: OPERATOR_SMOKE.adminUserId,
    tenantId: OPERATOR_SMOKE.tenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-finance-unit",
  };

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    // Force static DEV_TENANTS gate (avoid Prisma tenant lookup for smoke id).
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

  function seedBooking(registrationId: string): void {
    getBookingsRepository().seedBooking({
      id: registrationId,
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: OPERATOR_SMOKE.seedTourId,
      tourTitle: "Unit Finance Tour",
      guestLabel: "Unit Guest",
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

  async function seedPendingReceipt(input: {
    readonly registrationId: string;
    readonly withBooking: boolean;
    readonly bookingPayments?: IBookingPaymentPort;
  }): Promise<{
    readonly finance: FinanceService;
    readonly financeRepo: InMemoryFinanceRepository;
    readonly receiptId: string;
    readonly paymentId: string;
  }> {
    const financeRepo = new InMemoryFinanceRepository(
      input.bookingPayments ?? new BookingPaymentAdapter()
    );
    const finance = new FinanceService(
      new DenaliFinanceLedgerPolicyAdapter(),
      financeRepo,
      input.bookingPayments ?? new BookingPaymentAdapter()
    );

    if (input.withBooking) {
      seedBooking(input.registrationId);
    }

    const payment = await financeRepo.createManualPayment({
      tenantId: OPERATOR_SMOKE.tenantId,
      registrationId: input.registrationId,
      amount: "2500000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    const receipt = await financeRepo.createReceipt({
      tenantId: OPERATOR_SMOKE.tenantId,
      paymentId: payment.id,
      fileKey: `receipts/${payment.id}/unit-proof.jpg`,
    });
    return { finance, financeRepo, receiptId: receipt.id, paymentId: payment.id };
  }

  it("FIN-SVC-01 approve raises booking.paymentStatus to paid and returns bookingPaymentStatus", async () => {
    const registrationId = randomUUID();
    const { finance, receiptId } = await seedPendingReceipt({
      registrationId,
      withBooking: true,
    });

    const reviewed = await finance.reviewReceipt(operatorAuth, receiptId, {
      decision: "approve",
      reviewNote: "unit verified",
    });

    assert.equal(reviewed.status, "Approved");
    assert.equal(reviewed.bookingPaymentStatus, "paid");

    const booking = await getBookingsRepository().getById(registrationId, OPERATOR_SMOKE.tenantId);
    assert.equal(booking?.paymentStatus, "paid");
  });

  it("FIN-SVC-02 missing booking → SYNC_MISS, payment Pending, receipt not Approved", async () => {
    const registrationId = randomUUID();
    const { finance, financeRepo, receiptId, paymentId } = await seedPendingReceipt({
      registrationId,
      withBooking: false,
    });

    await assert.rejects(
      () => finance.reviewReceipt(operatorAuth, receiptId, { decision: "approve" }),
      (error: unknown) =>
        error instanceof Error && error.message === "FINANCE_BOOKING_PAYMENT_SYNC_MISS"
    );

    const payment = await financeRepo.findPaymentById(OPERATOR_SMOKE.tenantId, paymentId);
    assert.equal(payment?.status, "Pending");
    const receipt = await financeRepo.findReceiptById(OPERATOR_SMOKE.tenantId, receiptId);
    assert.equal(receipt?.status, "Pending");
  });

  it("FIN-SVC-03 bookingPayments.syncStatus throw → SYNC_FAILED, payment reverted, receipt not Approved", async () => {
    const registrationId = randomUUID();
    const failingPort: IBookingPaymentPort = {
      async syncStatus() {
        throw new Error("BOOKINGS_DB_UNAVAILABLE");
      },
      async raisePaidInTx() {
        throw new Error("BOOKINGS_DB_UNAVAILABLE");
      },
      async memberOwnsRegistration() {
        return true;
      },
      async getPaymentStatus() {
        return null;
      },
    };
    const { finance, financeRepo, receiptId, paymentId } = await seedPendingReceipt({
      registrationId,
      withBooking: true,
      bookingPayments: failingPort,
    });

    await assert.rejects(
      () => finance.reviewReceipt(operatorAuth, receiptId, { decision: "approve" }),
      (error: unknown) =>
        error instanceof Error && error.message === "FINANCE_BOOKING_PAYMENT_SYNC_FAILED"
    );

    const payment = await financeRepo.findPaymentById(OPERATOR_SMOKE.tenantId, paymentId);
    assert.equal(payment?.status, "Pending");
    const receipt = await financeRepo.findReceiptById(OPERATOR_SMOKE.tenantId, receiptId);
    assert.equal(receipt?.status, "Pending");
  });

  it("FIN-SVC-04 reviewReceipt approve calls IBookingPaymentPort.syncStatus (memory fake)", async () => {
    const registrationId = randomUUID();
    const syncCalls: BookingPaymentSyncStatusInput[] = [];
    const trackingPort: IBookingPaymentPort = {
      async syncStatus(input) {
        syncCalls.push(input);
        return new BookingPaymentAdapter().syncStatus(input);
      },
      async raisePaidInTx(tx, input) {
        return new BookingPaymentAdapter().raisePaidInTx(tx, input);
      },
      async memberOwnsRegistration(input) {
        return new BookingPaymentAdapter().memberOwnsRegistration(input);
      },
      async getPaymentStatus(input) {
        return new BookingPaymentAdapter().getPaymentStatus(input);
      },
    };

    const { finance, receiptId } = await seedPendingReceipt({
      registrationId,
      withBooking: true,
      bookingPayments: trackingPort,
    });

    const reviewed = await finance.reviewReceipt(operatorAuth, receiptId, {
      decision: "approve",
    });

    assert.equal(reviewed.status, "Approved");
    assert.equal(syncCalls.length, 1);
    assert.equal(syncCalls[0]?.tenantId, OPERATOR_SMOKE.tenantId);
    assert.equal(syncCalls[0]?.registrationId, registrationId);
    assert.equal(syncCalls[0]?.paymentStatus, "paid");
  });
});
