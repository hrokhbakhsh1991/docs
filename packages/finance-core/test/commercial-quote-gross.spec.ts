/**
 * CQ-1D — gross vs payable commercial quote split.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";

import { CommercialQuoteService } from "../src/application/commercial-quote.service.ts";
import { createFinanceService } from "../src/application/finance.service.ts";
import {
  mapLiveObligationToQuoteInput,
  type LiveRegistrationObligation,
} from "../src/domain/commercial-quote/map-obligation.ts";
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
const OPS = "00000000-0000-4000-8000-000000000031";
const REGISTRATION = "00000000-0000-4000-8000-000000000101";

function opsAuth(): FinanceActorContext {
  return {
    userId: OPS,
    tenantId: TENANT_A,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-cq-gross",
  };
}

function obligationPort(
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
    async setRegistrationObligationOverride(input) {
      obligation = {
        currency: obligation.currency,
        obligationMinor: input.obligationMinor,
        grossObligationMinor: obligation.grossObligationMinor ?? obligation.obligationMinor,
        source: "operator_override",
      };
      return true;
    },
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
      return input.tenantId === TENANT_A;
    },
    async getPaymentStatus() {
      return "unpaid";
    },
    async getRegistrationLifecycleStatus() {
      return "approved";
    },
  };
}

function createHarness(
  obligation: LiveRegistrationObligation,
  collection: "offline" | "free" = "offline"
) {
  const booking = approvedBookingPort();
  const repo = new InMemoryFinanceRepository(booking);
  const quoteRepo = new InMemoryCommercialQuoteRepository();
  const port = obligationPort(obligation, collection);
  const commercialQuotes = new CommercialQuoteService(quoteRepo, port, FakeClock);
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
    port,
    "0",
    nullFinanceArObservationPort,
    commercialQuotes
  );
  return { finance, quoteRepo, commercialQuotes, port };
}

describe("commercial-quote-gross.spec.ts — CQ-1D", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
    resetInMemoryCommercialQuoteRepositoryForTests();
  });

  it("CQ-GROSS-01: normal pricing gross equals payable", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      currency: "IRR",
      obligationMinor: "100000000",
      source: "tour_canonical",
    });

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-cq-gross-01"
    );

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(active !== null);
    assert.equal(active.grossMinor, "100000000");
    assert.equal(active.payableMinor, "100000000");
    assert.equal(active.source, "tour_canonical");
  });

  it("CQ-GROSS-02: override preserves gross while payable changes", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness({
      currency: "IRR",
      obligationMinor: "80000000",
      grossObligationMinor: "100000000",
      source: "operator_override",
    });

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-cq-gross-02"
    );

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(active !== null);
    assert.equal(active.grossMinor, "100000000");
    assert.equal(active.payableMinor, "80000000");
    assert.equal(active.source, "operator_override");
  });

  it("CQ-GROSS-03: free collection preserves gross with zero payable", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness(
      {
        currency: "IRR",
        obligationMinor: "0",
        grossObligationMinor: "100000000",
        source: "tour_canonical",
      },
      "free"
    );

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "0", currency: "IRR" },
      "idem-cq-gross-03"
    );

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(active !== null);
    assert.equal(active.grossMinor, "100000000");
    assert.equal(active.payableMinor, "0");
    assert.equal(active.source, "free_collection");
  });

  it("CQ-GROSS-04: invoice uses payable not gross", async () => {
    const registrationId = randomUUID();
    const { finance } = createHarness({
      currency: "IRR",
      obligationMinor: "80000000",
      grossObligationMinor: "100000000",
      source: "operator_override",
    });

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-cq-gross-04-freeze"
    );

    const invoice = await finance.getRegistrationInvoice(opsAuth(), registrationId);
    assert.equal(invoice.invoiceTotalMinor, "80000000");
  });

  it("CQ-GROSS-05: legacy quotes without gross field remain readable via mapper default", async () => {
    const quoteRepo = new InMemoryCommercialQuoteRepository();
    const service = new CommercialQuoteService(
      quoteRepo,
      obligationPort({
        currency: "IRR",
        obligationMinor: "5000000",
        source: "tour_canonical",
      }),
      FakeClock
    );

    const legacyMapped = mapLiveObligationToQuoteInput({
      tenantId: TENANT_A,
      registrationId: REGISTRATION,
      obligation: { currency: "IRR", obligationMinor: "5000000", source: "tour_canonical" },
    });
    const quote = await service.createQuoteVersion(legacyMapped);

    const readBack = await service.getActiveQuote(TENANT_A, REGISTRATION);
    assert.ok(readBack !== null);
    assert.equal(readBack.grossMinor, quote.grossMinor);
    assert.equal(readBack.payableMinor, quote.payableMinor);
    assert.equal(readBack.grossMinor, "5000000");
    assert.equal(readBack.payableMinor, "5000000");
  });
});
