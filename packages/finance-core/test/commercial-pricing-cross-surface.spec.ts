/**
 * Cross-surface commercial pricing consistency (CQ-DISPLAY).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import type {
  CommercialQuoteFreezeContextPort,
  MembershipDiscountReadPort,
} from "@app-tour/finance-core/ports";
import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";

import { CommercialQuoteService } from "../src/application/commercial-quote.service.ts";
import { createFinanceService } from "../src/application/finance.service.ts";
import { readTourAllowMembershipDiscount } from "../src/domain/commercial-quote/read-tour-membership-discount-gate.ts";
import type { LiveRegistrationObligation } from "../src/domain/commercial-quote/map-obligation.ts";
import { nullFinanceArObservationPort } from "../src/ports/finance-ar-observation.port.ts";
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
  InMemoryCommercialQuoteRepository,
  resetInMemoryCommercialQuoteRepositoryForTests,
} from "./isolation/in-memory-commercial-quote.repository.ts";
import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./isolation/in-memory-finance.repository.ts";

const TENANT = "00000000-0000-4000-8000-0000000000aa";
const MEMBER_USER = "00000000-0000-4000-8000-000000000201";
const OPS = "00000000-0000-4000-8000-000000000031";

type FinanceActorContext = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: string;
  readonly status: string;
  readonly workspaceId: string;
};

function opsAuth(): FinanceActorContext {
  return {
    userId: OPS,
    tenantId: TENANT,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-cq-display",
  };
}

function memberAuth(): FinanceActorContext {
  return {
    userId: MEMBER_USER,
    tenantId: TENANT,
    role: "member",
    status: "ACTIVE",
    workspaceId: "ws-cq-display",
  };
}

function tourCanonical(allowMembershipDiscount: boolean, prepaymentPercent = 30) {
  return {
    data: {
      pricing: {
        basePricePerPerson: 10_000_000,
        paymentMode: "offline_receipt",
        allowMembershipDiscount,
        prepaymentEnabled: true,
        prepaymentPercent,
      },
    },
  };
}

function createHarness(input: {
  readonly tourCanonical: unknown;
  readonly obligation: LiveRegistrationObligation;
  readonly discountPercent: number;
}) {
  const registrationId = randomUUID();
  const obligationPort: FinanceObligationPort = {
    async resolveRegistrationObligation() {
      return input.obligation;
    },
    async resolveRegistrationPaymentCollection() {
      return "offline";
    },
    async setRegistrationObligationOverride() {
      return false;
    },
  };
  const freezeContext: CommercialQuoteFreezeContextPort = {
    async resolveRegistrationFreezeContext() {
      return {
        memberUserId: MEMBER_USER,
        allowMembershipDiscount: readTourAllowMembershipDiscount(input.tourCanonical),
      };
    },
  };
  const membershipDiscount: MembershipDiscountReadPort = {
    async getMembershipDiscountPercentage() {
      return input.discountPercent;
    },
  };
  const booking: IBookingPaymentPort = {
    async syncStatus(i) {
      return i.paymentStatus;
    },
    async raisePaidInTx() {
      return "paid";
    },
    async memberOwnsRegistration() {
      return true;
    },
    async getPaymentStatus() {
      return "unpaid";
    },
    async getRegistrationLifecycleStatus() {
      return "approved";
    },
  };
  const quoteRepo = new InMemoryCommercialQuoteRepository();
  const commercialQuotes = new CommercialQuoteService(
    quoteRepo,
    obligationPort,
    FakeClock,
    freezeContext,
    membershipDiscount
  );
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
    obligationPort,
    "0",
    nullFinanceArObservationPort,
    commercialQuotes
  );
  return { finance, commercialQuotes, registrationId, quoteRepo };
}

describe("commercial-pricing-cross-surface.spec.ts — CQ-DISPLAY", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
    resetInMemoryCommercialQuoteRepositoryForTests();
  });

  it("CQ-DISPLAY-01: 50% gate-on — marketing/portal/finance/payment amounts align at 5M", async () => {
    const { finance, commercialQuotes, registrationId } = createHarness({
      tourCanonical: tourCanonical(true),
      obligation: {
        currency: "IRR",
        obligationMinor: "10000000",
        source: "tour_canonical",
      },
      discountPercent: 50,
    });

    const pricing = await commercialQuotes.resolveRegistrationCommercialPricing(
      TENANT,
      registrationId
    );
    assert.ok(pricing !== null);
    assert.equal(pricing.grossMinor, "10000000");
    assert.equal(pricing.memberDiscountMinor, "5000000");
    assert.equal(pricing.payableMinor, "5000000");
    assert.equal(pricing.quoteSource, "member_discount");

    const invoice = await finance.getRegistrationInvoice(opsAuth(), registrationId);
    assert.equal(invoice.invoiceTotalMinor, "5000000");
    assert.equal(invoice.balanceDueMinor, "5000000");
    assert.equal(invoice.commercialPricing?.payableMinor, "5000000");

    const prepayment = (
      (BigInt(invoice.invoiceTotalMinor) * BigInt(30)) /
      BigInt(100)
    ).toString();
    assert.equal(prepayment, "1500000");
  });

  it("CQ-DISPLAY-02: gate-off keeps 10M and flags blocked membership discount", async () => {
    const { commercialQuotes, finance, registrationId } = createHarness({
      tourCanonical: tourCanonical(false),
      obligation: {
        currency: "IRR",
        obligationMinor: "10000000",
        source: "tour_canonical",
      },
      discountPercent: 50,
    });

    const pricing = await commercialQuotes.resolveRegistrationCommercialPricing(
      TENANT,
      registrationId
    );
    assert.ok(pricing !== null);
    assert.equal(pricing.payableMinor, "10000000");
    assert.equal(pricing.quoteSource, "tour_canonical");
    assert.equal(pricing.membershipDiscountBlocked, true);
    assert.equal(pricing.memberPermanentDiscountPercentage, 50);

    const invoice = await finance.getRegistrationInvoice(opsAuth(), registrationId);
    assert.equal(invoice.invoiceTotalMinor, "10000000");
    assert.equal(invoice.balanceDueMinor, "10000000");
  });

  it("CQ-DISPLAY-03: transport add-on — 50% on trip only yields 6M payable and 1.8M prepay", async () => {
    const { commercialQuotes, finance, registrationId } = createHarness({
      tourCanonical: tourCanonical(true),
      obligation: {
        currency: "IRR",
        obligationMinor: "10000000",
        grossObligationMinor: "10000000",
        discountableBaseMinor: "8000000",
        source: "tour_canonical",
      },
      discountPercent: 50,
    });

    const pricing = await commercialQuotes.resolveRegistrationCommercialPricing(
      TENANT,
      registrationId
    );
    assert.ok(pricing !== null);
    assert.equal(pricing.grossMinor, "10000000");
    assert.equal(pricing.memberDiscountMinor, "4000000");
    assert.equal(pricing.payableMinor, "6000000");

    const invoice = await finance.getRegistrationInvoice(opsAuth(), registrationId);
    assert.equal(invoice.invoiceTotalMinor, "6000000");
    const prepayment = (
      (BigInt(invoice.invoiceTotalMinor) * BigInt(30)) /
      BigInt(100)
    ).toString();
    assert.equal(prepayment, "1800000");
  });

  it("CQ-DISPLAY-04: stale frozen quote superseded on approve when discount assigned", async () => {
    const registrationId = randomUUID();
    let discountPercent = 0;
    const obligation: LiveRegistrationObligation = {
      currency: "IRR",
      obligationMinor: "10000000",
      source: "tour_canonical",
    };
    const obligationPort: FinanceObligationPort = {
      async resolveRegistrationObligation() {
        return obligation;
      },
      async resolveRegistrationPaymentCollection() {
        return "offline";
      },
      async setRegistrationObligationOverride() {
        return false;
      },
    };
    const quoteRepo = new InMemoryCommercialQuoteRepository();
    const commercialQuotes = new CommercialQuoteService(
      quoteRepo,
      obligationPort,
      FakeClock,
      {
        async resolveRegistrationFreezeContext() {
          return { memberUserId: MEMBER_USER, allowMembershipDiscount: true };
        },
      },
      {
        async getMembershipDiscountPercentage() {
          return discountPercent;
        },
      }
    );

    const frozenNoDiscount = await commercialQuotes.ensureFrozenOnApprove(TENANT, registrationId);
    assert.equal(frozenNoDiscount?.payableMinor, "10000000");

    discountPercent = 50;
    const refrozen = await commercialQuotes.ensureFrozenOnApprove(TENANT, registrationId);
    assert.equal(refrozen?.payableMinor, "5000000");
    assert.equal(refrozen?.source, "member_discount");
  });

  it("CQ-DISPLAY-05: frozen quote preserved when membership discount decreases after freeze", async () => {
    const registrationId = randomUUID();
    let discountPercent = 50;
    const obligation: LiveRegistrationObligation = {
      currency: "IRR",
      obligationMinor: "1000000",
      source: "tour_canonical",
    };
    const obligationPort: FinanceObligationPort = {
      async resolveRegistrationObligation() {
        return obligation;
      },
      async resolveRegistrationPaymentCollection() {
        return "offline";
      },
      async setRegistrationObligationOverride() {
        return false;
      },
    };
    const quoteRepo = new InMemoryCommercialQuoteRepository();
    const commercialQuotes = new CommercialQuoteService(
      quoteRepo,
      obligationPort,
      FakeClock,
      {
        async resolveRegistrationFreezeContext() {
          return { memberUserId: MEMBER_USER, allowMembershipDiscount: true };
        },
      },
      {
        async getMembershipDiscountPercentage() {
          return discountPercent;
        },
      }
    );
    const finance = createFinanceService(
      createFakeLedgerPolicy(),
      new InMemoryFinanceRepository({
        async syncStatus(i) {
          return i.paymentStatus;
        },
        async raisePaidInTx() {
          return "paid";
        },
        async memberOwnsRegistration() {
          return true;
        },
        async getPaymentStatus() {
          return "unpaid";
        },
        async getRegistrationLifecycleStatus() {
          return "approved";
        },
      }),
      {
        async syncStatus(i) {
          return i.paymentStatus;
        },
        async raisePaidInTx() {
          return "paid";
        },
        async memberOwnsRegistration() {
          return true;
        },
        async getPaymentStatus() {
          return "unpaid";
        },
        async getRegistrationLifecycleStatus() {
          return "approved";
        },
      },
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
      obligationPort,
      "0",
      nullFinanceArObservationPort,
      commercialQuotes
    );

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "100000", currency: "IRR" },
      "idem-cq-display-05"
    );
    const frozen = await quoteRepo.getActive(TENANT, registrationId);
    assert.ok(frozen !== null);
    assert.equal(frozen.payableMinor, "500000");

    discountPercent = 20;
    const pricing = await commercialQuotes.resolveRegistrationCommercialPricing(
      TENANT,
      registrationId
    );
    assert.equal(pricing?.payableMinor, "500000");

    const invoice = await finance.getRegistrationInvoice(opsAuth(), registrationId);
    assert.equal(invoice.invoiceTotalMinor, "500000");
  });
});
