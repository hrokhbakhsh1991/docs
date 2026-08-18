/**
 * Phase 4 — free collection marks booking paid; blocks member receipt.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";

import { createFinanceService } from "../src/application/finance.service.ts";
import type { FinanceActorContext } from "../src/ports/finance-actor-context.ts";
import type {
  BookingPaymentLifecycleStatus,
  BookingPaymentSyncStatus,
  IBookingPaymentPort,
} from "../src/ports/booking-payment.port.ts";
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

const TENANT = "00000000-0000-4000-8000-0000000000cc";
const OWNER = "00000000-0000-4000-8000-000000000021";

function memberAuth(): FinanceActorContext {
  return {
    userId: OWNER,
    tenantId: TENANT,
    role: "member",
    status: "ACTIVE",
    workspaceId: "ws-free",
  };
}

function createBookingPort(input: {
  lifecycle: BookingPaymentLifecycleStatus;
  paymentStatus: BookingPaymentSyncStatus;
}): IBookingPaymentPort & { paymentStatus: BookingPaymentSyncStatus } {
  const state = { paymentStatus: input.paymentStatus };
  return {
    get paymentStatus() {
      return state.paymentStatus;
    },
    async syncStatus(syncInput) {
      state.paymentStatus = syncInput.paymentStatus;
      return state.paymentStatus;
    },
    async raisePaidInTx() {
      state.paymentStatus = "paid";
      return "paid";
    },
    async memberOwnsRegistration(ownsInput) {
      return ownsInput.tenantId === TENANT && ownsInput.userId === OWNER;
    },
    async getPaymentStatus() {
      return state.paymentStatus;
    },
    async getRegistrationLifecycleStatus() {
      return input.lifecycle;
    },

  };
}

function freeObligation(): FinanceObligationPort {
  return {
    async resolveRegistrationObligation() {
      return { currency: "IRR", obligationMinor: "0", source: "tour_canonical" };
    },
    async resolveRegistrationPaymentCollection() {
      return "free";
    },
    async setRegistrationObligationOverride() {
      return false;
    },
  };
}

function offlineObligation(): FinanceObligationPort {
  return {
    async resolveRegistrationObligation() {
      return { currency: "IRR", obligationMinor: "1000", source: "tour_canonical" };
    },
    async resolveRegistrationPaymentCollection() {
      return "offline";
    },
    async setRegistrationObligationOverride() {
      return false;
    },
  };
}

describe("FIN-FREE-COLLECT phase 4", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
  });

  it("applyFreeCollectionPayment marks paid when approved + free", async () => {
    const registrationId = randomUUID();
    const booking = createBookingPort({ lifecycle: "approved", paymentStatus: "unpaid" });
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
      FakeClock,
      freeObligation()
    );

    const result = await finance.applyFreeCollectionPayment({
      tenantId: TENANT,
      registrationId,
    });
    assert.equal(result.applied, true);
    assert.equal(result.paymentStatus, "paid");
    assert.equal(booking.paymentStatus, "paid");
  });

  it("applyFreeCollectionPayment no-ops for offline collection", async () => {
    const registrationId = randomUUID();
    const booking = createBookingPort({ lifecycle: "approved", paymentStatus: "unpaid" });
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
      FakeClock,
      offlineObligation()
    );

    const result = await finance.applyFreeCollectionPayment({
      tenantId: TENANT,
      registrationId,
    });
    assert.equal(result.applied, false);
    assert.equal(booking.paymentStatus, "unpaid");
  });

  it("member receipt rejected when collection is free", async () => {
    const registrationId = randomUUID();
    const booking = createBookingPort({ lifecycle: "approved", paymentStatus: "unpaid" });
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
      FakeClock,
      freeObligation()
    );

    await assert.rejects(
      () =>
        finance.submitMemberReceiptForRegistration(memberAuth(), {
          registrationId,
          fileKey: `receipts/${TENANT}/${registrationId}/x.pdf`,
        }),
      /FINANCE_RECEIPT_NOT_REQUIRED/
    );
  });

  it("member receipt status waived when collection is free and remaining is 0", async () => {
    const registrationId = randomUUID();
    const booking = createBookingPort({ lifecycle: "approved", paymentStatus: "paid" });
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
      FakeClock,
      freeObligation()
    );

    const status = await finance.getMemberReceiptStatusForRegistration(
      memberAuth(),
      registrationId
    );
    assert.equal(status.status, "waived");
    assert.equal(status.remainingMinor, "0");
  });
});
