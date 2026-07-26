/**
 * Phase 1.4 — finance-owned HTTP contracts ownership proofs.
 * FIN-P1.4-01 Denali parse parity (compat re-export)
 * FIN-P1.4-02 FinanceService does not import workspace-denali HTTP
 * FIN-P1.4-03 WS2 engine accepts same finance-http-contracts bodies
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import {
  parseCreateManualPaymentBody,
  parseGenerateScheduleBody,
  parseRecordPrepaymentBody,
  parseReviewReceiptBody,
  parseSubmitReceiptBody,
  type CreateManualPaymentBody,
} from "@app-tour/finance-http-contracts";
import {
  parseCreateManualPaymentBody as parseCreateManualPaymentBodyDenali,
  parseGenerateScheduleBody as parseGenerateScheduleBodyDenali,
  parseRecordPrepaymentBody as parseRecordPrepaymentBodyDenali,
  parseReviewReceiptBody as parseReviewReceiptBodyDenali,
  parseSubmitReceiptBody as parseSubmitReceiptBodyDenali,
} from "@app-tour/workspace-denali/http";

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
import { FINANCE_WS2_WORKSPACE_TYPE } from "@app-tour/workspace-finance-ws2";
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
const REGISTRATION_ID = "11111111-1111-4111-8111-111111111111";
const PAYMENT_ID = "22222222-2222-4222-8222-222222222222";

describe("finance-http-contracts.spec.ts — Phase 1.4", { concurrency: false }, () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorDatabaseUrl = process.env.DATABASE_URL;

  const operatorAuth: TenantAuthContext = {
    userId: OPERATOR_SMOKE.adminUserId,
    tenantId: OPERATOR_SMOKE.tenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-finance-http-contracts",
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

  it("FIN-P1.4-01 Denali HTTP re-export preserves parse behavior", () => {
    const validManual = {
      registrationId: REGISTRATION_ID,
      amount: "2500000",
      currency: "IRR",
    };
    assert.deepEqual(
      parseCreateManualPaymentBody(validManual),
      parseCreateManualPaymentBodyDenali(validManual)
    );

    const validSubmit = {
      paymentId: PAYMENT_ID,
      fileKey: "receipts/proof.pdf",
      note: "ok",
    };
    assert.deepEqual(parseSubmitReceiptBody(validSubmit), parseSubmitReceiptBodyDenali(validSubmit));

    const validReview = { decision: "approve" as const, reviewNote: "lgtm" };
    assert.deepEqual(parseReviewReceiptBody(validReview), parseReviewReceiptBodyDenali(validReview));

    const validPrepay = {
      registrationId: REGISTRATION_ID,
      amountMinor: "10000",
      currency: "USD",
      method: "cash",
    };
    assert.deepEqual(
      parseRecordPrepaymentBody(validPrepay),
      parseRecordPrepaymentBodyDenali(validPrepay)
    );

    const validSchedule = {
      registrationId: REGISTRATION_ID,
      template: {
        depositPercent: 20,
        installmentCount: 2,
        firstDueAt: "2026-08-01T00:00:00.000Z",
        invoiceTotalMinor: "100000",
        currency: "IRR",
      },
    };
    assert.deepEqual(
      parseGenerateScheduleBody(validSchedule),
      parseGenerateScheduleBodyDenali(validSchedule)
    );

    assert.throws(
      () => parseCreateManualPaymentBody({ registrationId: "not-uuid", amount: "1", currency: "IRR" }),
      /ZOD_VALIDATION_FAILED/
    );
    try {
      parseCreateManualPaymentBody({ registrationId: "not-uuid", amount: "1", currency: "IRR" });
    } catch (contractsErr: unknown) {
      try {
        parseCreateManualPaymentBodyDenali({
          registrationId: "not-uuid",
          amount: "1",
          currency: "IRR",
        });
      } catch (denaliErr: unknown) {
        assert.equal(
          contractsErr instanceof Error ? contractsErr.message : null,
          denaliErr instanceof Error ? denaliErr.message : undefined
        );
      }
    }
  });

  it("FIN-P1.4-02 FinanceService source does not import workspace-denali HTTP", () => {
    const serviceSrc = readFileSync(
      resolve(FINANCE_ROOT, "../../../../packages/finance-core/src/application/finance.service.ts"),
      "utf8"
    );
    assert.doesNotMatch(serviceSrc, /@app-tour\/workspace-denali\/http/);
    assert.match(serviceSrc, /@app-tour\/finance-http-contracts/);
  });

  it("FIN-P1.4-03 WS2 FinanceService accepts shared finance-http-contracts bodies", async () => {
    const registrationId = randomUUID();
    getBookingsRepository().seedBooking({
      id: registrationId,
      tenantId: OPERATOR_SMOKE.tenantId,
      tourId: OPERATOR_SMOKE.seedTourId,
      tourTitle: "WS2 Contracts Tour",
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

    const bookingPayments = new BookingPaymentAdapter(getBookingsRepository());
    const financeRepo = new InMemoryFinanceRepository(bookingPayments);
    const finance = createFinanceService(
      await resolveFinanceLedgerPolicy(FINANCE_WS2_WORKSPACE_TYPE),
      financeRepo,
      bookingPayments,
      await resolveFinanceReceiptDefaults(FINANCE_WS2_WORKSPACE_TYPE),
      new BookingRegistrationDisplayAdapter(),
      fakeNoopMetrics,
      fakeMemoryPersistenceMode,
      fakeReceiptProofUrl,
      fakePermissiveCapability,
      fakePermissiveAccess,
      fakeEmptySchedules,
      fakeNoopLog,
      fakeFixedClock
    );

    const body: CreateManualPaymentBody = parseCreateManualPaymentBody({
      registrationId,
      amount: "10000",
      currency: "USD",
    });

    const created = await finance.createManualPayment(
      operatorAuth,
      body,
      `p14-ws2-${registrationId}`
    );
    assert.equal(typeof created, "object");
    assert.ok(created !== null);
    const row = created as { registrationId: string; amount: string; currency: string };
    assert.equal(row.registrationId, registrationId);
    assert.equal(row.amount, "10000");
    assert.equal(row.currency, "USD");
  });
});
