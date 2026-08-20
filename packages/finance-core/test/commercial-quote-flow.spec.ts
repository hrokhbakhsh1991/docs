/**
 * CQ-1B — commercial quote money-path + invoice integration.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";

import { CommercialQuoteService } from "../src/application/commercial-quote.service.ts";
import { createFinanceService } from "../src/application/finance.service.ts";
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
const OPS = "00000000-0000-4000-8000-000000000031";

function opsAuth(tenantId = TENANT_A): FinanceActorContext {
  return {
    userId: OPS,
    tenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-cq",
  };
}

function createMutableObligation(initialMinor = "5000000"): {
  readonly port: FinanceObligationPort;
  setMinor(minor: string, source?: "tour_canonical" | "operator_override"): void;
} {
  let minor = initialMinor;
  let source: "tour_canonical" | "operator_override" = "tour_canonical";
  return {
    port: {
      async resolveRegistrationObligation() {
        return { currency: "IRR", obligationMinor: minor, source };
      },
      async resolveRegistrationPaymentCollection() {
        return "offline";
      },
      async setRegistrationObligationOverride(input) {
        minor = input.obligationMinor;
        source = "operator_override";
        return true;
      },
    },
    setMinor(nextMinor, nextSource = "tour_canonical") {
      minor = nextMinor;
      source = nextSource;
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

function createHarness(options?: {
  readonly withQuotes?: boolean;
  readonly obligation?: FinanceObligationPort;
}) {
  const booking = approvedBookingPort();
  const repo = new InMemoryFinanceRepository(booking);
  const quoteRepo = new InMemoryCommercialQuoteRepository();
  const obligation = options?.obligation ?? createMutableObligation().port;
  const commercialQuotes =
    options?.withQuotes === false
      ? null
      : new CommercialQuoteService(quoteRepo, obligation, FakeClock);

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

  return { finance, repo, quoteRepo, commercialQuotes, obligation };
}

describe("commercial-quote-flow.spec.ts — CQ-1B", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
    resetInMemoryCommercialQuoteRepositoryForTests();
  });

  it("CQ-FLOW-01: first money action creates quote", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness();

    await finance.createManualPayment(
      opsAuth(),
      {
        registrationId,
        amount: "1000000",
        currency: "IRR",
      },
      "idem-cq-flow-01"
    );

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.ok(active !== null);
    assert.equal(active.payableMinor, "5000000");
    assert.equal(active.status, "FROZEN");
  });

  it("CQ-FLOW-02: passive invoice read does not create quote", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness();

    await finance.getRegistrationInvoice(opsAuth(), registrationId);

    assert.equal(await quoteRepo.getActive(TENANT_A, registrationId), null);
  });

  it("CQ-FLOW-03: invoice uses quote when available", async () => {
    const registrationId = randomUUID();
    const obligation = createMutableObligation("5000000");
    const { finance, quoteRepo } = createHarness({ obligation: obligation.port });

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-cq-flow-03-freeze"
    );

    obligation.setMinor("9999999");

    const invoice = await finance.getRegistrationInvoice(opsAuth(), registrationId);
    assert.equal(invoice.invoiceTotalMinor, "5000000");
    assert.equal((await quoteRepo.getActive(TENANT_A, registrationId))?.payableMinor, "5000000");
  });

  it("CQ-FLOW-04: no quote keeps legacy live resolver", async () => {
    const registrationId = randomUUID();
    const obligation = createMutableObligation("5000000");
    const { finance } = createHarness({ withQuotes: false, obligation: obligation.port });

    obligation.setMinor("7200000");
    const invoice = await finance.getRegistrationInvoice(opsAuth(), registrationId);
    assert.equal(invoice.invoiceTotalMinor, "7200000");
  });

  it("CQ-FLOW-05: override creates/supersedes quote", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness();

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-cq-flow-05a"
    );
    const v1 = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.equal(v1?.payableMinor, "5000000");

    await finance.setRegistrationObligationOverride(opsAuth(), {
      registrationId,
      obligationMinor: "4200000",
    });

    const chain = await quoteRepo.getChain(TENANT_A, registrationId);
    assert.equal(chain.length, 2);
    assert.equal(chain[0]?.status, "SUPERSEDED");
    assert.equal(chain[1]?.status, "FROZEN");
    assert.equal(chain[1]?.payableMinor, "4200000");
    assert.equal(chain[1]?.source, "operator_override");
  });

  it("CQ-FLOW-06: payment capture locks quote", async () => {
    const registrationId = randomUUID();
    const { finance, repo, quoteRepo } = createHarness();

    await finance.createManualPayment(
      opsAuth(),
      { registrationId, amount: "5000000", currency: "IRR" },
      "idem-cq-flow-06-pay"
    );

    const payment = await repo.createManualPayment({
      tenantId: TENANT_A,
      registrationId,
      amount: "5000000",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    const receipt = await repo.createReceipt({
      tenantId: TENANT_A,
      paymentId: payment.id,
      fileKey: "proof/receipt.jpg",
      status: "Pending",
    });

    await finance.reviewReceipt(opsAuth(), receipt.id, { decision: "approve" });

    const active = await quoteRepo.getActive(TENANT_A, registrationId);
    assert.equal(active?.status, "LOCKED");

    await assert.rejects(
      () =>
        finance.setRegistrationObligationOverride(opsAuth(), {
          registrationId,
          obligationMinor: "1000000",
        }),
      /COMMERCIAL_QUOTE_CHAIN_LOCKED/
    );
  });

  it("CQ-FLOW-07: wrong tenant cannot access quote", async () => {
    const registrationId = randomUUID();
    const { finance, quoteRepo } = createHarness();

    await finance.createManualPayment(
      opsAuth(TENANT_A),
      { registrationId, amount: "1000000", currency: "IRR" },
      "idem-cq-flow-07"
    );

    assert.equal(await quoteRepo.getActive(TENANT_B, registrationId), null);
    assert.deepEqual(await quoteRepo.getChain(TENANT_B, registrationId), []);
  });
});
