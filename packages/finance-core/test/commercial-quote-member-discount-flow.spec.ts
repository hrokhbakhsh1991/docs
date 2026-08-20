/**
 * CQ-2B — member discount commercial quote freeze integration.
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

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const TENANT_B = "00000000-0000-4000-8000-0000000000bb";
const MEMBER_USER = "00000000-0000-4000-8000-000000000201";
const OPS = "00000000-0000-4000-8000-000000000031";

function opsAuth(tenantId = TENANT_A): FinanceActorContext {
  return {
    userId: OPS,
    tenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-cq-disc",
  };
}

function createObligationPort(
  obligation: LiveRegistrationObligation,
  collection: "offline" | "free" = "offline"
): FinanceObligationPort {
  return {
    async resolveRegistrationObligation() {
      return obligation;
    },
    async resolveRegistrationPaymentCollection() {
      return collection;
    },
    async setRegistrationObligationOverride() {
      return false;
    },
  };
}

function createFreezeContextPort(input: {
  memberUserId?: string | null;
  allowMembershipDiscount?: boolean;
}): CommercialQuoteFreezeContextPort {
  return {
    async resolveRegistrationFreezeContext() {
      return {
        memberUserId: input.memberUserId ?? MEMBER_USER,
        allowMembershipDiscount: input.allowMembershipDiscount ?? true,
      };
    },
  };
}

function createMembershipDiscountPort(
  discountsByTenant: Readonly<Record<string, number | null>>
): MembershipDiscountReadPort {
  return {
    async getMembershipDiscountPercentage(tenantId, _userId) {
      if (!(tenantId in discountsByTenant)) {
        return null;
      }
      return discountsByTenant[tenantId] ?? null;
    },
  };
}

function approvedBookingPort(tenantId = TENANT_A): IBookingPaymentPort {
  return {
    async syncStatus(input) {
      return input.paymentStatus;
    },
    async raisePaidInTx() {
      return "paid";
    },
    async memberOwnsRegistration(input) {
      return input.tenantId === tenantId;
    },
    async getPaymentStatus() {
      return "unpaid";
    },
    async getRegistrationLifecycleStatus() {
      return "approved";
    },
  };
}

function createHarness(input: {
  obligation: LiveRegistrationObligation;
  collection?: "offline" | "free";
  freezeContext?: CommercialQuoteFreezeContextPort;
  membershipDiscount?: MembershipDiscountReadPort;
}) {
  const booking = approvedBookingPort();
  const repo = new InMemoryFinanceRepository(booking);
  const quoteRepo = new InMemoryCommercialQuoteRepository();
  const obligation = createObligationPort(input.obligation, input.collection ?? "offline");
  const commercialQuotes = new CommercialQuoteService(
    quoteRepo,
    obligation,
    FakeClock,
    input.freezeContext ?? createFreezeContextPort({}),
    input.membershipDiscount ?? createMembershipDiscountPort({ [TENANT_A]: 20 })
  );
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
    obligation,
    "0",
    nullFinanceArObservationPort,
    commercialQuotes
  );
  return { finance, quoteRepo };
}

describe("commercial-quote-member-discount-flow.spec.ts — CQ-2B", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
    resetInMemoryCommercialQuoteRepositoryForTests();
  });

  it("CQ-DISC-FLOW-01: gate true + member 20% → member_discount", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      obligation: {
        currency: "IRR",
        obligationMinor: "1000000",
        source: "tour_canonical",
      },
      freezeContext: createFreezeContextPort({
        allowMembershipDiscount: true,
      }),
      membershipDiscount: createMembershipDiscountPort({ [TENANT_A]: 20 }),
    });

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "100000", currency: "IRR" },
      "idem-cq-disc-flow-01"
    );

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(active !== null);
    assert.equal(active.source, "member_discount");
    assert.equal(active.grossMinor, "1000000");
    assert.equal(active.payableMinor, "800000");
    assert.equal(active.memberDiscount?.percentageApplied, 20);
    assert.equal(active.memberDiscount?.discountMinor, "200000");
    assert.equal(active.memberDiscount?.memberUserId, MEMBER_USER);
  });

  it("CQ-DISC-FLOW-02: gate false → tour_canonical", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      obligation: {
        currency: "IRR",
        obligationMinor: "1000000",
        source: "tour_canonical",
      },
      freezeContext: createFreezeContextPort({
        allowMembershipDiscount: false,
      }),
      membershipDiscount: createMembershipDiscountPort({ [TENANT_A]: 20 }),
    });

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "100000", currency: "IRR" },
      "idem-cq-disc-flow-02"
    );

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(active !== null);
    assert.equal(active.source, "tour_canonical");
    assert.equal(active.payableMinor, "1000000");
    assert.equal(active.memberDiscount, undefined);
  });

  it("CQ-DISC-FLOW-03: override wins over member discount", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      obligation: {
        currency: "IRR",
        obligationMinor: "700000",
        grossObligationMinor: "1000000",
        source: "operator_override",
      },
      freezeContext: createFreezeContextPort({
        allowMembershipDiscount: true,
      }),
      membershipDiscount: createMembershipDiscountPort({ [TENANT_A]: 20 }),
    });

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "100000", currency: "IRR" },
      "idem-cq-disc-flow-03"
    );

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(active !== null);
    assert.equal(active.source, "operator_override");
    assert.equal(active.grossMinor, "1000000");
    assert.equal(active.payableMinor, "700000");
  });

  it("CQ-DISC-FLOW-04: free collection wins over member discount", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      obligation: {
        currency: "IRR",
        obligationMinor: "0",
        grossObligationMinor: "1000000",
        source: "tour_canonical",
      },
      collection: "free",
      freezeContext: createFreezeContextPort({
        allowMembershipDiscount: true,
      }),
      membershipDiscount: createMembershipDiscountPort({ [TENANT_A]: 20 }),
    });

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "0", currency: "IRR" },
      "idem-cq-disc-flow-04"
    );

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(active !== null);
    assert.equal(active.source, "free_collection");
    assert.equal(active.payableMinor, "0");
    assert.equal(active.grossMinor, "1000000");
  });

  it("CQ-DISC-FLOW-05: missing membership → tour_canonical", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      obligation: {
        currency: "IRR",
        obligationMinor: "1000000",
        source: "tour_canonical",
      },
      membershipDiscount: createMembershipDiscountPort({ [TENANT_A]: null }),
    });

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "100000", currency: "IRR" },
      "idem-cq-disc-flow-05"
    );

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(active !== null);
    assert.equal(active.source, "tour_canonical");
    assert.equal(active.payableMinor, "1000000");
  });

  it("CQ-DISC-FLOW-06: wrong tenant → no discount", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      obligation: {
        currency: "IRR",
        obligationMinor: "1000000",
        source: "tour_canonical",
      },
      membershipDiscount: createMembershipDiscountPort({ [TENANT_A]: 20 }),
    });

    await finance.createManualPayment(
      opsAuth(TENANT_B),
      { registrationId, amount: "100000", currency: "IRR" },
      "idem-cq-disc-flow-06"
    );

    const active = await quoteRepo.getActive(TENANT_B, registrationId);
    assert.ok(active !== null);
    assert.equal(active.source, "tour_canonical");
    assert.equal(active.payableMinor, "1000000");
  });

  it("CQ-DISC-FLOW-07: quote metadata persisted on version", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      obligation: {
        currency: "IRR",
        obligationMinor: "5000000",
        source: "tour_canonical",
      },
      membershipDiscount: createMembershipDiscountPort({ [TENANT_A]: 15 }),
    });

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "100000", currency: "IRR" },
      "idem-cq-disc-flow-07"
    );

    const chain = await quoteRepo.getChain(TENANT_A, registrationId);
    assert.equal(chain.length, 1);
    const quote = chain[0];
    assert.ok(quote !== undefined);
    assert.equal(quote.source, "member_discount");
    assert.equal(quote.memberDiscount?.percentageApplied, 15);
    assert.equal(quote.memberDiscount?.discountMinor, "750000");
    assert.equal(quote.memberDiscount?.memberUserId, MEMBER_USER);
    assert.equal(
      quote.memberDiscount?.membershipReference,
      `userTenant:${TENANT_A}:${MEMBER_USER}`
    );
  });
});
