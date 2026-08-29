import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import type { FinanceService } from "@app-tour/finance-core/application";

import {
  getBookingsRepository,
  resetBookingsRepositoryForTests,
} from "../bookings/create-bookings-repository.ts";
import { resetPaymentHoldRepositoryForTests } from "./payment-hold.repository.ts";
import { PaymentHoldService } from "./payment-hold.service.ts";
import { wrapFinanceServiceWithPaymentHold } from "./wrap-finance-service-payment-hold.ts";

const TENANT = "00000000-0000-4000-8000-0000000000dd";
const USER = "00000000-0000-4000-8000-000000000031";

const auth = {
  userId: USER,
  tenantId: TENANT,
  role: "admin",
  status: "ACTIVE",
  workspaceId: "ws-payment-hold",
} as const;

describe("wrapFinanceServiceWithPaymentHold", { concurrency: false }, () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorDatabaseUrl = process.env.DATABASE_URL;
  const priorPaymentHoldEnabled = process.env.PAYMENT_HOLD_ENABLED;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    process.env.PAYMENT_HOLD_ENABLED = "true";
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
    if (priorPaymentHoldEnabled === undefined) {
      delete process.env.PAYMENT_HOLD_ENABLED;
    } else {
      process.env.PAYMENT_HOLD_ENABLED = priorPaymentHoldEnabled;
    }
  });

  beforeEach(() => {
    resetBookingsRepositoryForTests();
    resetPaymentHoldRepositoryForTests();
  });

  function seedApprovedBooking(registrationId: string, paymentDueAt: string): void {
    getBookingsRepository().seedBooking({
      id: registrationId,
      tenantId: TENANT,
      tourId: "00000000-0000-4000-8000-000000000220",
      tourTitle: "Payment Hold Unit Tour",
      guestLabel: "Payment Hold Guest",
      guestEmail: null,
      guestPhone: null,
      partySize: 1,
      status: "approved",
      paymentStatus: "unpaid",
      departureAt: "2026-09-01T00:00:00.000Z",
      submittedAt: "2026-08-01T00:00:00.000Z",
      submittedByUserId: USER,
      approvedAt: "2026-08-01T00:00:00.000Z",
      paymentDueAt,
    });
  }

  function fakeService(): FinanceService {
    return {
      async createManualPayment() {
        return { id: randomUUID(), status: "Pending" };
      },
      async submitReceipt() {
        return { id: randomUUID() };
      },
      async reviewReceipt() {
        return {};
      },
      async getRegistrationInvoice(_auth, registrationId) {
        return {
          registrationId,
          currency: "IRR",
          invoiceTotalMinor: "0",
          paidAmountMinor: "0",
          balanceDueMinor: "0",
          remainingMinor: "0",
          walletNetMinor: "0",
          refundedMinor: "0",
        };
      },
      async setRegistrationObligationOverride(_auth, input) {
        return {
          registrationId: input.registrationId,
          obligationMinor: input.obligationMinor,
          source: "operator_override" as const,
          paymentStatus: "paid" as const,
          freePaidApplied: true,
        };
      },
    } as unknown as FinanceService;
  }

  it("clears paymentDueAt when zero obligation override satisfies an open hold", async () => {
    const registrationId = randomUUID();
    const approvedAt = "2026-08-01T00:00:00.000Z";
    const hold = await new PaymentHoldService().scheduleOnApprove({
      tenantId: TENANT,
      registrationId,
      approvedAt,
      policyHours: 24,
    });
    seedApprovedBooking(registrationId, hold.dueAt);

    const service = wrapFinanceServiceWithPaymentHold(fakeService());
    await service.setRegistrationObligationOverride(auth, {
      registrationId,
      obligationMinor: "0",
      reason: "waive",
    });

    const booking = await getBookingsRepository().getById(registrationId, TENANT);
    const updatedHold = await new PaymentHoldService().getByRegistrationId(TENANT, registrationId);
    assert.equal(booking?.paymentDueAt ?? null, null);
    assert.equal(updatedHold?.status, "satisfied");
  });
});
