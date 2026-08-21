/**
 * CQ-2D — membership discount gate end-to-end freeze scenarios.
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
    workspaceId: "ws-cq-e2e",
  };
}

function tourCanonicalGate(enabled: boolean | undefined) {
  return {
    data: {
      pricing: {
        basePricePerPerson: 1_000_000,
        paymentMode: "offline_receipt",
        ...(enabled === undefined ? {} : { allowMembershipDiscount: enabled }),
      },
    },
  };
}

function createTourGateFreezeContext(
  tourCanonical: unknown,
  memberUserId = MEMBER_USER
): CommercialQuoteFreezeContextPort {
  return {
    async resolveRegistrationFreezeContext() {
      return {
        memberUserId,
        allowMembershipDiscount: readTourAllowMembershipDiscount(tourCanonical),
      };
    },
  };
}

function createMembershipDiscountByTenant(
  discounts: Readonly<Record<string, number | null>>
): MembershipDiscountReadPort {
  return {
    async getMembershipDiscountPercentage(tenantId, _userId) {
      return discounts[tenantId] ?? null;
    },
  };
}

function createHarness(input: {
  tourCanonical: unknown;
  obligation?: LiveRegistrationObligation;
  tenantId?: string;
  membershipDiscount?: MembershipDiscountReadPort;
}) {
  const tenantId = input.tenantId ?? TENANT_A;
  const obligation: LiveRegistrationObligation = input.obligation ?? {
    currency: "IRR",
    obligationMinor: "5000000",
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

  const booking: IBookingPaymentPort = {
    async syncStatus(i) {
      return i.paymentStatus;
    },
    async raisePaidInTx() {
      return "paid";
    },
    async memberOwnsRegistration(i) {
      return i.tenantId === tenantId;
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
    createTourGateFreezeContext(input.tourCanonical),
    input.membershipDiscount ?? createMembershipDiscountByTenant({ [TENANT_A]: 20, [TENANT_B]: 0 })
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

  return { finance, quoteRepo, tenantId };
}

describe("commercial-quote-member-discount-e2e.spec.ts — CQ-2D", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
    resetInMemoryCommercialQuoteRepositoryForTests();
  });

  it("CQ-E2E-01: tour gate true + 20% membership → member_discount", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      tourCanonical: tourCanonicalGate(true),
    });

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-cq-e2e-01"
    );

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(active !== null);
    assert.equal(active.source, "member_discount");
    assert.equal(active.grossMinor, "5000000");
    assert.equal(active.payableMinor, "4000000");
    assert.equal(active.memberDiscount?.percentageApplied, 20);
  });

  it("CQ-E2E-01b: portal-style invoice read freezes 20% member discount", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      tourCanonical: tourCanonicalGate(true),
      obligation: {
        currency: "IRR",
        obligationMinor: "1000000",
        source: "tour_canonical",
      },
    });

    const invoice = await finance.getRegistrationInvoice(opsAuth(), registrationId);

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(active !== null);
    assert.equal(active.source, "member_discount");
    assert.equal(active.grossMinor, "1000000");
    assert.equal(active.payableMinor, "800000");
    assert.equal(active.memberDiscount?.percentageApplied, 20);
    assert.equal(active.memberDiscount?.discountMinor, "200000");
    assert.equal(invoice.invoiceTotalMinor, "800000");
  });

  it("CQ-E2E-01c: portal-style invoice read keeps zero-discount member at canonical gross", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      tenantId: TENANT_B,
      tourCanonical: tourCanonicalGate(true),
      obligation: {
        currency: "IRR",
        obligationMinor: "1000000",
        source: "tour_canonical",
      },
    });

    const invoice = await finance.getRegistrationInvoice(opsAuth(TENANT_B), registrationId);

    const active = await quoteRepo.getActive(TENANT_B, registrationId);
    assert.ok(active !== null);
    assert.equal(active.source, "tour_canonical");
    assert.equal(active.grossMinor, "1000000");
    assert.equal(active.payableMinor, "1000000");
    assert.equal(active.memberDiscount, undefined);
    assert.equal(invoice.invoiceTotalMinor, "1000000");
  });

  it("CQ-E2E-01d: membership discount applies only to discountable tour base", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      tourCanonical: tourCanonicalGate(true),
      obligation: {
        currency: "IRR",
        obligationMinor: "1300000",
        grossObligationMinor: "1300000",
        discountableBaseMinor: "1000000",
        source: "tour_canonical",
      },
    });

    const invoice = await finance.getRegistrationInvoice(opsAuth(), registrationId);

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(active !== null);
    assert.equal(active.source, "member_discount");
    assert.equal(active.grossMinor, "1300000");
    assert.equal(active.memberDiscount?.discountMinor, "200000");
    assert.equal(active.payableMinor, "1100000");
    assert.equal(invoice.invoiceTotalMinor, "1100000");
  });

  it("CQ-E2E-02: tour gate false ignores membership discount", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      tourCanonical: tourCanonicalGate(false),
    });

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-cq-e2e-02"
    );

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(active !== null);
    assert.equal(active.source, "tour_canonical");
    assert.equal(active.payableMinor, active.grossMinor);
    assert.equal(active.memberDiscount, undefined);
  });

  it("CQ-E2E-03: missing tour gate fail closed", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      tourCanonical: tourCanonicalGate(undefined),
    });

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-cq-e2e-03"
    );

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(active !== null);
    assert.equal(active.source, "tour_canonical");
    assert.equal(active.payableMinor, "5000000");
  });

  it("CQ-E2E-04: same user different tenant discounts produce different quotes", async () => {
    const registrationA = randomUUID();
    const registrationB = randomUUID();
    const harnessA = createHarness({ tourCanonical: tourCanonicalGate(true), tenantId: TENANT_A });
    const harnessB = createHarness({ tourCanonical: tourCanonicalGate(true), tenantId: TENANT_B });

    await harnessA.finance.createManualPayment(
      opsAuth(TENANT_A),
      { registrationId: registrationA, amount: "1000000", currency: "IRR" },
      "idem-cq-e2e-04a"
    );
    await harnessB.finance.createManualPayment(
      opsAuth(TENANT_B),
      { registrationId: registrationB, amount: "1000000", currency: "IRR" },
      "idem-cq-e2e-04b"
    );

    const quoteA = await harnessA.quoteRepo.getActive(TENANT_A, registrationA);
    const quoteB = await harnessB.quoteRepo.getActive(TENANT_B, registrationB);
    assert.equal(quoteA?.source, "member_discount");
    assert.equal(quoteA?.payableMinor, "4000000");
    assert.equal(quoteB?.source, "tour_canonical");
    assert.equal(quoteB?.payableMinor, "5000000");
  });

  it("CQ-E2E-05: live tour price change does not mutate frozen quote", async () => {
    const registrationId = randomUUID();
    let obligationMinor = "5000000";
    const obligation: LiveRegistrationObligation = {
      currency: "IRR",
      get obligationMinor() {
        return obligationMinor;
      },
      source: "tour_canonical",
    };

    const { finance, quoteRepo } = createHarness({
      tourCanonical: tourCanonicalGate(true),
      obligation,
    });

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-cq-e2e-05-freeze"
    );

    const frozen = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(frozen !== null);
    assert.equal(frozen.source, "member_discount");
    assert.equal(frozen.payableMinor, "4000000");

    obligationMinor = "9900000";

    const invoice = await finance.getRegistrationInvoice(opsAuth(), registrationId);
    assert.equal(invoice.invoiceTotalMinor, "4000000");
    const after = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.equal(after?.payableMinor, frozen.payableMinor);
    assert.equal(after?.grossMinor, frozen.grossMinor);
  });
});
