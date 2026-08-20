/**
 * CQ-1A — Commercial Quote domain foundation (DEC-CQ-001..013 subset).
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { CommercialQuoteService } from "../src/application/commercial-quote.service.ts";
import {
  commercialQuoteCommercialFieldsEqual,
  type CommercialQuoteVersion,
} from "../src/domain/commercial-quote/index.ts";
import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";
import {
  FakeClock,
} from "./isolation/fakes.ts";
import {
  InMemoryCommercialQuoteRepository,
  resetInMemoryCommercialQuoteRepositoryForTests,
} from "./isolation/in-memory-commercial-quote.repository.ts";

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const TENANT_B = "00000000-0000-4000-8000-0000000000bb";
const REGISTRATION = "00000000-0000-4000-8000-000000000101";

function staticObligation(
  amountMinor = "5000000",
  source: "tour_canonical" | "operator_override" = "tour_canonical"
): FinanceObligationPort {
  return {
    async resolveRegistrationObligation() {
      return { currency: "IRR", obligationMinor: amountMinor, source };
    },
    async resolveRegistrationPaymentCollection() {
      return "offline";
    },
    async setRegistrationObligationOverride() {
      return false;
    },
  };
}

function baseInput(overrides: Partial<Parameters<CommercialQuoteService["createQuoteVersion"]>[0]> = {}) {
  return {
    tenantId: TENANT_A,
    registrationId: REGISTRATION,
    grossMinor: "5000000",
    payableMinor: "5000000",
    currency: "irr",
    source: "tour_canonical" as const,
    ...overrides,
  };
}

describe("commercial-quote-domain.spec.ts — CQ-1A", () => {
  let repository: InMemoryCommercialQuoteRepository;
  let service: CommercialQuoteService;

  beforeEach(() => {
    resetInMemoryCommercialQuoteRepositoryForTests();
    repository = new InMemoryCommercialQuoteRepository();
    service = new CommercialQuoteService(repository, staticObligation(), FakeClock);
  });

  it("CQ-DOMAIN-01: create first quote", async () => {
    const quote = await service.createQuoteVersion(baseInput());

    assert.equal(quote.versionNumber, 1);
    assert.equal(quote.status, "FROZEN");
    assert.equal(quote.grossMinor, "5000000");
    assert.equal(quote.payableMinor, "5000000");
    assert.equal(quote.currency, "IRR");
    assert.equal(quote.source, "tour_canonical");
    assert.equal(quote.supersedesVersionId, null);

    const active = await service.getActiveQuote(TENANT_A, REGISTRATION);
    assert.equal(active?.id, quote.id);
  });

  it("CQ-DOMAIN-02: supersede creates new version", async () => {
    const v1 = await service.createQuoteVersion(baseInput());
    const v2 = await service.supersedeQuote(
      baseInput({
        grossMinor: "5000000",
        payableMinor: "4500000",
        source: "operator_override",
      })
    );

    assert.equal(v2.versionNumber, 2);
    assert.equal(v2.status, "FROZEN");
    assert.equal(v2.supersedesVersionId, v1.id);
    assert.equal(v2.source, "operator_override");
    assert.equal(v2.payableMinor, "4500000");

    const active = await service.getActiveQuote(TENANT_A, REGISTRATION);
    assert.equal(active?.id, v2.id);

    const chain = await service.getQuoteChain(TENANT_A, REGISTRATION);
    assert.equal(chain.length, 2);
    assert.equal(chain[0]?.status, "SUPERSEDED");
    assert.equal(chain[1]?.status, "FROZEN");
  });

  it("CQ-DOMAIN-03: previous quote remains unchanged", async () => {
    const v1 = await service.createQuoteVersion(baseInput());
    const v1Snapshot: CommercialQuoteVersion = { ...v1 };

    await service.supersedeQuote(
      baseInput({
        payableMinor: "4000000",
        source: "operator_override",
      })
    );

    const chain = await service.getQuoteChain(TENANT_A, REGISTRATION);
    const v1After = chain.find((row) => row.id === v1.id);
    assert.ok(v1After !== undefined);
    assert.equal(v1After.status, "SUPERSEDED");
    assert.ok(commercialQuoteCommercialFieldsEqual(v1Snapshot, v1After));
    assert.equal(v1After.grossMinor, "5000000");
    assert.equal(v1After.payableMinor, "5000000");
  });

  it("CQ-DOMAIN-04: lock chain", async () => {
    await service.createQuoteVersion(baseInput());
    const lockedChain = await service.lockQuoteChain(TENANT_A, REGISTRATION);

    const active = lockedChain.find((row) => row.status === "LOCKED");
    assert.ok(active !== undefined);
    assert.equal(active.versionNumber, 1);

    const readActive = await service.getActiveQuote(TENANT_A, REGISTRATION);
    assert.equal(readActive?.status, "LOCKED");
  });

  it("CQ-DOMAIN-05: locked chain rejects supersede", async () => {
    await service.createQuoteVersion(baseInput());
    await service.lockQuoteChain(TENANT_A, REGISTRATION);

    await assert.rejects(
      () =>
        service.supersedeQuote(
          baseInput({
            payableMinor: "1000000",
            source: "operator_override",
          })
        ),
      /COMMERCIAL_QUOTE_CHAIN_LOCKED/
    );
  });

  it("CQ-DOMAIN-06: wrong tenant cannot access quote", async () => {
    const quote = await service.createQuoteVersion(baseInput());

    assert.equal(await service.getActiveQuote(TENANT_B, REGISTRATION), null);
    assert.deepEqual(await service.getQuoteChain(TENANT_B, REGISTRATION), []);

    await assert.rejects(
      () => repository.markSuperseded(TENANT_B, quote.id),
      /COMMERCIAL_QUOTE_NOT_FOUND/
    );
  });
});
