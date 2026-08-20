/**
 * CQ-2C — member discount metadata persistence (in-memory repository).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import { buildMemberDiscountQuoteMetadata } from "../src/domain/commercial-quote/member-discount.ts";
import { CommercialQuoteService } from "../src/application/commercial-quote.service.ts";
import { createFinanceService } from "../src/application/finance.service.ts";
import type { IBookingPaymentPort } from "../src/ports/booking-payment.port.ts";
import { nullFinanceArObservationPort } from "../src/ports/finance-ar-observation.port.ts";
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
  InMemoryCommercialQuoteRepository,
  resetInMemoryCommercialQuoteRepositoryForTests,
} from "./isolation/in-memory-commercial-quote.repository.ts";
import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./isolation/in-memory-finance.repository.ts";

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const TENANT_B = "00000000-0000-4000-8000-0000000000bb";
const MEMBER_USER = "00000000-0000-4000-8000-000000000201";
const OPS = "00000000-0000-4000-8000-000000000031";

function memberDiscountQuoteInput(registrationId: string) {
  const memberDiscount = buildMemberDiscountQuoteMetadata({
    tenantId: TENANT_A,
    memberUserId: MEMBER_USER,
    percentageApplied: 20,
    discountMinor: "2000000",
  });
  return {
    tenantId: TENANT_A,
    registrationId,
    grossMinor: "10000000",
    payableMinor: "8000000",
    currency: "IRR",
    source: "member_discount" as const,
    memberDiscount,
  };
}

function opsAuth(tenantId = TENANT_A): FinanceActorContext {
  return {
    userId: OPS,
    tenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-cq-persist",
  };
}

describe("commercial-quote-member-discount-persist.spec.ts — CQ-2C", () => {
  beforeEach(() => {
    resetInMemoryCommercialQuoteRepositoryForTests();
    resetInMemoryFinanceRepositoryForTests();
  });

  it("CQ-DISC-PERSIST-01: create member discount quote and reload", async () => {
    const registrationId = randomUUID();
    const writer = new InMemoryCommercialQuoteRepository();
    const created = await writer.createVersion(memberDiscountQuoteInput(registrationId));

    const reader = new InMemoryCommercialQuoteRepository();
    const active = await reader.getActive(TENANT_A, registrationId);

    assert.ok(active !== null);
    assert.equal(active.source, "member_discount");
    assert.equal(active.grossMinor, "10000000");
    assert.equal(active.payableMinor, "8000000");
    assert.equal(active.memberDiscount?.percentageApplied, 20);
    assert.equal(active.memberDiscount?.discountMinor, "2000000");
    assert.equal(active.memberDiscount?.memberUserId, MEMBER_USER);
    assert.equal(active.id, created.id);
  });

  it("CQ-DISC-PERSIST-02: metadata survives repository reload", async () => {
    const registrationId = randomUUID();
    const writer = new InMemoryCommercialQuoteRepository();
    await writer.createVersion(memberDiscountQuoteInput(registrationId));

    const reloadedChain = await new InMemoryCommercialQuoteRepository().getChain(
      TENANT_A,
      registrationId
    );
    const quote = reloadedChain[0];
    assert.ok(quote !== undefined);
    assert.equal(quote.memberDiscount?.membershipReference, `userTenant:${TENANT_A}:${MEMBER_USER}`);
    assert.equal(quote.memberDiscount?.percentageApplied, 20);
  });

  it("CQ-DISC-PERSIST-03: tenant isolation", async () => {
    const registrationId = randomUUID();
    const writer = new InMemoryCommercialQuoteRepository();
    const created = await writer.createVersion(memberDiscountQuoteInput(registrationId));

    const reader = new InMemoryCommercialQuoteRepository();
    assert.equal(await reader.getActive(TENANT_B, registrationId), null);
    assert.deepEqual(await reader.getChain(TENANT_B, registrationId), []);
    await assert.rejects(
      () => reader.markSuperseded(TENANT_B, created.id),
      /COMMERCIAL_QUOTE_NOT_FOUND/
    );
  });

  it("CQ-DISC-PERSIST-04: invoice still uses payableMinor only", async () => {
    const registrationId = randomUUID();
    const quoteRepo = new InMemoryCommercialQuoteRepository();
    await quoteRepo.createVersion(memberDiscountQuoteInput(registrationId));

    const obligation: FinanceObligationPort = {
      async resolveRegistrationObligation() {
        return {
          currency: "IRR",
          obligationMinor: "10000000",
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

    const booking: IBookingPaymentPort = {
      async syncStatus(input) {
        return input.paymentStatus;
      },
      async raisePaidInTx() {
        return "paid";
      },
      async memberOwnsRegistration(input) {
        return input.tenantId === TENANT_A;
      },
      async getPaymentStatus() {
        return "unpaid";
      },
      async getRegistrationLifecycleStatus() {
        return "approved";
      },
    };

    const commercialQuotes = new CommercialQuoteService(quoteRepo, obligation, FakeClock);

    const finance = createFinanceService(
      createFakeLedgerPolicy(),
      new InMemoryFinanceRepository(booking),
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
      obligation,
      "0",
      nullFinanceArObservationPort,
      commercialQuotes
    );

    const reloaded = await new InMemoryCommercialQuoteRepository().getActive(
      TENANT_A,
      registrationId
    );
    assert.ok(reloaded !== null);
    assert.equal(reloaded.grossMinor, "10000000");
    assert.equal(reloaded.payableMinor, "8000000");
    assert.ok(reloaded.memberDiscount !== undefined);

    const invoice = await finance.getRegistrationInvoice(opsAuth(), registrationId);
    assert.equal(invoice.invoiceTotalMinor, "8000000");
    assert.notEqual(invoice.invoiceTotalMinor, reloaded.grossMinor);
  });
});
