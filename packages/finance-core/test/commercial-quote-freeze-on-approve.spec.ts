/**
 * DP1-D — Commercial Quote freeze on approve (DEN-PROD-11).
 * @see docs/dev/dp-1-execution-plan.md
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";

import { CommercialQuoteService } from "../src/application/commercial-quote.service.ts";
import {
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

const TENANT = "00000000-0000-4000-8000-0000000000aa";

function createMutableObligation(initialMinor = "5000000"): {
  readonly port: FinanceObligationPort;
  setMinor(minor: string): void;
} {
  let minor = initialMinor;
  return {
    port: {
      async resolveRegistrationObligation() {
        return { currency: "IRR", obligationMinor: minor, source: "tour_canonical" };
      },
      async resolveRegistrationPaymentCollection() {
        return "offline";
      },
      async setRegistrationObligationOverride(input) {
        minor = input.obligationMinor;
        return true;
      },
    },
    setMinor(nextMinor: string) {
      minor = nextMinor;
    },
  };
}

describe("DP1-D commercial quote freeze on approve", () => {
  beforeEach(() => {
    resetInMemoryCommercialQuoteRepositoryForTests();
  });

  it("DP1-D-02 S1: ensureFrozenOnApprove exists and creates v1 FROZEN", async () => {
    const registrationId = randomUUID();
    const obligation = createMutableObligation("7500000");
    const quoteRepo = new InMemoryCommercialQuoteRepository();
    const quotes = new CommercialQuoteService(quoteRepo, obligation.port, FakeClock);

    assert.equal(
      typeof (quotes as { ensureFrozenOnApprove?: unknown }).ensureFrozenOnApprove,
      "function",
      "DP1-EXPECTED-FAIL: CommercialQuoteService.ensureFrozenOnApprove not implemented"
    );

    const frozen = await (
      quotes as CommercialQuoteService & {
        ensureFrozenOnApprove(tenantId: string, registrationId: string): Promise<{
          payableMinor: string;
          status: string;
        } | null>;
      }
    ).ensureFrozenOnApprove(TENANT, registrationId);

    assert.ok(frozen !== null);
    assert.equal(frozen.status, "FROZEN");
    assert.equal(frozen.payableMinor, "7500000");
    const active = await quoteRepo.getActive(TENANT, registrationId);
    assert.ok(active !== null);
    assert.equal(active.payableMinor, "7500000");
    assert.equal(active.status, "FROZEN");
  });

  it("DP1-D-02 S14: tour price mutation after approve does not change frozen payable", async () => {
    const registrationId = randomUUID();
    const obligation = createMutableObligation("5000000");
    const quoteRepo = new InMemoryCommercialQuoteRepository();
    const quotes = new CommercialQuoteService(quoteRepo, obligation.port, FakeClock);

    const freeze = quotes as CommercialQuoteService & {
      ensureFrozenOnApprove(tenantId: string, registrationId: string): Promise<{
        payableMinor: string;
      } | null>;
    };
    assert.equal(typeof freeze.ensureFrozenOnApprove, "function");
    const first = await freeze.ensureFrozenOnApprove(TENANT, registrationId);
    assert.equal(first?.payableMinor, "5000000");

    obligation.setMinor("9999999");
    const active = await quoteRepo.getActive(TENANT, registrationId);
    assert.equal(active?.payableMinor, "5000000", "frozen quote must not retro-change");
  });

  it("DP1-D-02 free collection: ensureFrozenOnApprove returns zero payable", async () => {
    const registrationId = randomUUID();
    const obligation: FinanceObligationPort = {
      async resolveRegistrationObligation() {
        return { currency: "IRR", obligationMinor: "0", source: "tour_canonical" };
      },
      async resolveRegistrationPaymentCollection() {
        return "free";
      },
      async setRegistrationObligationOverride() {
        return true;
      },
    };
    const quoteRepo = new InMemoryCommercialQuoteRepository();
    const quotes = new CommercialQuoteService(quoteRepo, obligation, FakeClock);
    const freeze = quotes as CommercialQuoteService & {
      ensureFrozenOnApprove(tenantId: string, registrationId: string): Promise<{
        payableMinor: string;
        source: string;
      } | null>;
    };
    assert.equal(typeof freeze.ensureFrozenOnApprove, "function");
    const frozen = await freeze.ensureFrozenOnApprove(TENANT, registrationId);
    assert.ok(frozen !== null);
    assert.equal(frozen.payableMinor, "0");
    assert.equal(frozen.source, "free_collection");
  });

  it("DP1-D-02 money path still uses ensureFrozenForMoneyPath without duplicate freeze", async () => {
    const registrationId = randomUUID();
    const obligation = createMutableObligation();
    const quoteRepo = new InMemoryCommercialQuoteRepository();
    const quotes = new CommercialQuoteService(quoteRepo, obligation.port, FakeClock);
    const freeze = quotes as CommercialQuoteService & {
      ensureFrozenOnApprove(tenantId: string, registrationId: string): Promise<unknown>;
    };
    assert.equal(typeof freeze.ensureFrozenOnApprove, "function");
    await freeze.ensureFrozenOnApprove(TENANT, registrationId);
    const again = await quotes.ensureFrozenForMoneyPath(TENANT, registrationId);
    assert.ok(again !== null);
    assert.equal(again.status, "FROZEN");
    const chain = await quoteRepo.getChain(TENANT, registrationId);
    assert.equal(chain.length, 1, "approve freeze must not create duplicate versions");
  });
});
