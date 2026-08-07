/**
 * Phase 2 — member offline receipt auto-creates manual payment from tour obligation.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import { createFinanceService } from "../src/application/finance.service.ts";
import type { FinanceActorContext } from "../src/ports/finance-actor-context.ts";
import type { IBookingPaymentPort } from "../src/ports/booking-payment.port.ts";
import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";
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

const TENANT = "00000000-0000-4000-8000-0000000000bb";
const OWNER = "00000000-0000-4000-8000-000000000011";

function memberAuth(): FinanceActorContext {
  return {
    userId: OWNER,
    tenantId: TENANT,
    role: "member",
    status: "ACTIVE",
    workspaceId: "ws-obl",
  };
}

function approvedBookingPort(): IBookingPaymentPort {
  return {
    async syncStatus(input) {
      return input.paymentStatus;
    },
    async raisePaidInTx() {
      return "paid";
    },
    async memberOwnsRegistration(input) {
      return input.tenantId === TENANT && input.userId === OWNER;
    },
    async getPaymentStatus() {
      return "unpaid";
    },
    async getRegistrationLifecycleStatus() {
      return "approved";
    },

  };
}

function createService(obligation: FinanceObligationPort) {
  const booking = approvedBookingPort();
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
    obligation
  );
  return { finance, repo };
}

describe("FIN-RECEIPT-OBL member receipt payment amount", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
  });

  it("uses obligationMinor when obligation resolves", async () => {
    const registrationId = randomUUID();
    const obligation: FinanceObligationPort = {
      async resolveRegistrationObligation() {
        return {
          currency: "IRR",
          obligationMinor: "7500000",
          source: "tour_canonical",
        };
      },
      async resolveRegistrationPaymentCollection() {
        return "offline";
      },
      async setRegistrationObligationOverride() {
        return false;
      },
    };
    const { finance, repo } = createService(obligation);

    await finance.submitMemberReceiptForRegistration(memberAuth(), {
      registrationId,
      fileKey: `receipts/${TENANT}/${registrationId}/obl.pdf`,
    });

    const payment = await repo.findFirstPendingManualPayment(TENANT, registrationId);
    assert.ok(payment !== null);
    assert.equal(payment.amount, "7500000");
    assert.equal(payment.currency, "IRR");
  });

  it("falls back to receipt defaults when obligation is null", async () => {
    const registrationId = randomUUID();
    const obligation: FinanceObligationPort = {
      async resolveRegistrationObligation() {
        return null;
      },
      async resolveRegistrationPaymentCollection() {
        return "offline";
      },
      async setRegistrationObligationOverride() {
        return false;
      },
    };
    const { finance, repo } = createService(obligation);

    await finance.submitMemberReceiptForRegistration(memberAuth(), {
      registrationId,
      fileKey: `receipts/${TENANT}/${registrationId}/fallback.pdf`,
    });

    const payment = await repo.findFirstPendingManualPayment(TENANT, registrationId);
    assert.ok(payment !== null);
    assert.equal(payment.amount, "1000000");
    assert.equal(payment.currency, "IRR");
  });
});
