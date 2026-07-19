/**
 * DUP — Path A (approve capture) XOR Path B (TourCreated paid) single wallet credit.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import {
  registerTourCreatedFinanceSideEffectDeps,
  runTourCreatedFinanceSideEffect,
} from "@app-tour/workspace-denali/host/finance/api-tour-created-adapter";

import {
  isTourCreatedLedgerDomainEventId,
  tourCreatedLedgerDomainEventPrefix,
} from "../src/workspace-finance/registration-booking-wallet-credit";
import { paymentLedgerCaptureDomainEventId } from "../src/workspace-finance/paid-without-ledger-detection";

describe("DUP identity formulas (unchanged Path A / Path B ids)", () => {
  it("Path A capture id remains payment:{id}:ledger-capture-anchor", () => {
    const paymentId = "11111111-1111-4111-8111-111111111111";
    assert.equal(
      paymentLedgerCaptureDomainEventId(paymentId),
      `payment:${paymentId}:ledger-capture-anchor`
    );
  });

  it("Path B domainEventId prefix is finance.ledger:{registrationId}:tour-created:", () => {
    const registrationId = "22222222-2222-4222-8222-222222222222";
    const prefix = tourCreatedLedgerDomainEventPrefix(registrationId);
    assert.equal(prefix, `finance.ledger:${registrationId}:tour-created:`);
    assert.equal(
      isTourCreatedLedgerDomainEventId(`${prefix}${randomUUID()}`, registrationId),
      true
    );
    assert.equal(
      isTourCreatedLedgerDomainEventId(
        paymentLedgerCaptureDomainEventId(randomUUID()),
        registrationId
      ),
      false
    );
  });
});

describe("DUP-03 Path B replay / exclusive skip", () => {
  const tenantId = randomUUID();
  const domainEventId = randomUUID();
  const registrationId = randomUUID();
  const claimed = new Set<string>();
  const exclusiveCalls: string[] = [];

  beforeEach(() => {
    claimed.clear();
    exclusiveCalls.length = 0;
    registerTourCreatedFinanceSideEffectDeps({
      tryClaimProcessedEvent: async (_t, eventId) => {
        if (claimed.has(eventId)) {
          return false;
        }
        claimed.add(eventId);
        return true;
      },
      createOutboxWriter: () => ({
        addEvent: async () => {
          assert.fail("legacy writer must not run when exclusive is set");
          return true;
        },
      }),
      logTourCreatedFailed: () => {},
      emitPaidLedgerExclusive: async (input) => {
        exclusiveCalls.push(input.registrationId);
        if (exclusiveCalls.length === 1) {
          return "emitted";
        }
        return "skipped";
      },
    });
  });

  it("DUP-03 first TourCreated emits; replay claim blocks second exclusive call", async () => {
    const row = {
      tenantId,
      domainEventId,
      eventType: "TourCreated",
      aggregateType: "tour",
      aggregateId: randomUUID(),
      payload: {
        tenantId,
        registrationId,
        paidAmountMinor: "1500",
        currency: "USD",
      },
    };
    assert.equal(await runTourCreatedFinanceSideEffect(row), true);
    assert.equal(await runTourCreatedFinanceSideEffect(row), false);
    assert.equal(exclusiveCalls.length, 1);
  });

  it("DUP-01 style — exclusive skip when host reports already settled", async () => {
    registerTourCreatedFinanceSideEffectDeps({
      tryClaimProcessedEvent: async () => true,
      createOutboxWriter: () => ({
        addEvent: async () => true,
      }),
      logTourCreatedFailed: () => {},
      emitPaidLedgerExclusive: async () => "skipped",
    });
    const handled = await runTourCreatedFinanceSideEffect({
      tenantId: randomUUID(),
      domainEventId: randomUUID(),
      eventType: "TourCreated",
      aggregateType: "tour",
      aggregateId: randomUUID(),
      payload: {
        registrationId: randomUUID(),
        paidAmountMinor: "900",
        currency: "USD",
      },
    });
    assert.equal(handled, true);
  });
});
