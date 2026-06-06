/**
 * Functional + security — TourCreated from createTour through the in-process bus.
 *
 * Focus: valid events are published with the correct contract and delivered; malicious
 * injections are blocked before read-model side effects.
 *
 * Pentest / relay / aggregate-ownership edge cases:
 *   test/1-reliability/domain-event-consistency.spec.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, beforeEach, describe, it } from "node:test";

import type { DomainEventEnvelope } from "@app-tour/platform-events";
import {
  publishDomainEvent,
  resetDomainEventBusForTests,
  subscribeDomainEvent,
  subscribeDomainEventForTenant,
} from "@app-tour/platform-events";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { subscribeIdempotentDomainEvent } from "../../src/events/idempotent-domain-event-subscriber";
import type { TourCreatedEventPayload } from "../../src/events/tour-created-envelope-guard";
import { createTestToursService, integrationTenantId } from "../test-helpers";

const VALID_TOUR_BODY = {
  data: { basics: { title: "domain-event-flow" }, details: { summary: "ok" } },
} as const;

async function drainAsyncHandlers(rounds = 24): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

function authForTenant(tenantId: string): TenantAuthContext {
  return {
    userId: "evt-flow-user",
    tenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-evt-flow",
  };
}

type CapturedTourCreated = DomainEventEnvelope<TourCreatedEventPayload>;

describe("1-functional — TourCreated domain event flow", () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;

  beforeEach(() => {
    resetDomainEventBusForTests();
    process.env.STORAGE_DRIVER = "memory";
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
  });

  it("FUNC-EVT-01: createTour publishes TourCreated with contract-compliant envelope", async () => {
    const tenantId = integrationTenantId();
    const captured: CapturedTourCreated[] = [];

    subscribeDomainEvent<TourCreatedEventPayload>("TourCreated", (evt) => {
      captured.push(evt);
    });

    const service = createTestToursService();
    const record = await service.createTour(authForTenant(tenantId), { ...VALID_TOUR_BODY });
    await drainAsyncHandlers();

    assert.equal(captured.length, 1, "valid TourCreated must be published (not dropped)");
    const evt = captured[0]!;
    assert.equal(evt.type, "TourCreated");
    assert.equal(evt.tenantId, tenantId);
    assert.equal(evt.payload.tourId, record.id);
    assert.match(evt.eventId, /^[0-9a-f-]{36}$/i);
    assert.doesNotThrow(() => new Date(evt.occurredAt), "occurredAt must be parseable");
  });

  it("FUNC-EVT-02: valid TourCreated is delivered to matching tenant subscribers", async () => {
    const tenantId = integrationTenantId();
    const otherTenant = integrationTenantId();
    const globalSeen: string[] = [];
    const scopedSeen: string[] = [];

    subscribeDomainEvent<TourCreatedEventPayload>("TourCreated", (evt) => {
      globalSeen.push(evt.payload.tourId ?? "");
    });
    subscribeDomainEventForTenant<TourCreatedEventPayload>(tenantId, "TourCreated", (evt) => {
      scopedSeen.push(evt.payload.tourId ?? "");
    });
    subscribeDomainEventForTenant<TourCreatedEventPayload>(otherTenant, "TourCreated", () => {
      assert.fail("cross-tenant scoped subscriber must not receive event");
    });

    const service = createTestToursService();
    const record = await service.createTour(authForTenant(tenantId), { ...VALID_TOUR_BODY });
    await drainAsyncHandlers();

    assert.deepEqual(globalSeen, [record.id], "global subscriber must receive valid event");
    assert.deepEqual(scopedSeen, [record.id], "tenant-scoped subscriber must receive valid event");
  });

  it("FUNC-EVT-03: idempotent subscriber blocks injected cross-tenant TourCreated", async () => {
    const ownerTenant = integrationTenantId();
    const attackerTenant = integrationTenantId();
    const tourId = randomUUID();
    const readModelWrites: string[] = [];

    subscribeIdempotentDomainEvent<TourCreatedEventPayload>("TourCreated", (evt) => {
      readModelWrites.push(evt.payload.tourId ?? "");
    });

    publishDomainEvent<TourCreatedEventPayload>({
      tenantId: ownerTenant,
      type: "TourCreated",
      payload: { tourId, tenantId: attackerTenant },
    });

    await drainAsyncHandlers();

    assert.deepEqual(
      readModelWrites,
      [],
      "malicious cross-tenant TourCreated must not trigger read-model side effects"
    );
  });

  it("FUNC-EVT-04: bus rejects malformed TourCreated with empty tenantId", () => {
    assert.throws(
      () =>
        publishDomainEvent({
          tenantId: "   ",
          type: "TourCreated",
          payload: { tourId: randomUUID() },
        }),
      /DOMAIN_EVENT_TENANT_REQUIRED/
    );
  });
});
