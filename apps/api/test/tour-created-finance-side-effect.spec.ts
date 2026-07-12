/**
 * P5-E-N-005 — tour-created finance side effect (FIN-02)
 * @see docs/phase-18/platform-registrations-finance-tranche.mdoc
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import {
  registerTourCreatedFinanceSideEffectDeps,
  runTourCreatedFinanceSideEffect,
} from "../src/workspace/workspace-outbox-side-effects.generated.ts";

describe("tour-created-finance-side-effect (P5-E FIN-02)", () => {
  const tenantId = randomUUID();
  const domainEventId = randomUUID();
  const registrationId = randomUUID();
  const claimed = new Set<string>();
  const enqueued: unknown[] = [];

  beforeEach(() => {
    claimed.clear();
    enqueued.length = 0;
    registerTourCreatedFinanceSideEffectDeps({
      tryClaimProcessedEvent: async (_tenantId, eventId) => {
        if (claimed.has(eventId)) {
          return false;
        }
        claimed.add(eventId);
        return true;
      },
      createOutboxWriter: () => ({
        addEvent: async (event) => {
          enqueued.push(event);
        },
      }),
      logTourCreatedFailed: () => {},
    });
  });

  it("FIN-02 processes TourCreated row with finance payload", async () => {
    const handled = await runTourCreatedFinanceSideEffect({
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
    });

    assert.equal(handled, true);
    assert.equal(enqueued.length, 1);
  });

  it("FIN-02b skips rows without finance payload", async () => {
    const handled = await runTourCreatedFinanceSideEffect({
      tenantId,
      domainEventId: randomUUID(),
      eventType: "TourCreated",
      aggregateType: "tour",
      aggregateId: randomUUID(),
      payload: { tenantId },
    });

    assert.equal(handled, false);
    assert.equal(enqueued.length, 0);
  });

  it("FIN-02c replay returns false after first claim", async () => {
    const row = {
      tenantId,
      domainEventId,
      eventType: "TourCreated",
      aggregateType: "tour",
      aggregateId: randomUUID(),
      payload: {
        tenantId,
        registrationId,
        paidAmountMinor: "900",
        currency: "USD",
      },
    };

    assert.equal(await runTourCreatedFinanceSideEffect(row), true);
    assert.equal(await runTourCreatedFinanceSideEffect(row), false);
    assert.equal(enqueued.length, 1);
  });
});
