import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SHARED_DOMAIN_EVENT_INVENTORY,
  SHARED_DOMAIN_EVENT_SCHEMA_VERSION,
  findSharedDomainEventInventoryEntry,
  normalizeDomainEventType,
  toSharedDomainEventEnvelope,
} from "../src/shared-domain-event-contract";

describe("SDE-001 shared domain event contract", () => {
  it("covers mandatory business events in inventory", () => {
    const canonical = new Set(
      SHARED_DOMAIN_EVENT_INVENTORY.map((entry) => entry.canonicalEventType),
    );
    assert.ok(canonical.has("registration.approved"));
    assert.ok(canonical.has("payment.confirmed"));
    assert.ok(canonical.has("attendance.marked"));
    assert.ok(canonical.has("ticket.created"));
    assert.ok(canonical.has("tour.schedule.changed"));
  });

  it("normalizes compatibility aliases to canonical names", () => {
    assert.equal(normalizeDomainEventType("registration.approved"), "registration.approved");
    assert.equal(normalizeDomainEventType("RegistrationApproved"), "registration.approved");
    assert.equal(
      normalizeDomainEventType("finance.ledger.double_entry_applied"),
      "payment.confirmed",
    );
    assert.equal(normalizeDomainEventType("attendance.verified"), "attendance.marked");
    assert.equal(
      normalizeDomainEventType("tour.mutation.notification_required"),
      "tour.schedule.changed",
    );
    assert.equal(normalizeDomainEventType("ticket.created"), "ticket.created");
  });

  it("builds envelope from outbox row with defaults", () => {
    const envelope = toSharedDomainEventEnvelope({
      tenantId: "00000000-0000-4000-8000-000000000001",
      aggregateType: "registration",
      aggregateId: "00000000-0000-4000-8000-000000000002",
      eventType: "registration.approved",
      domainEventId: "00000000-0000-4000-8000-000000000003",
      correlationId: "corr-1",
      createdAt: new Date("2026-09-04T12:00:00.000Z"),
      payload: {
        guestUserId: "00000000-0000-4000-8000-000000000004",
        workspaceId: "denali",
      },
    });

    assert.equal(envelope.eventId, "00000000-0000-4000-8000-000000000003");
    assert.equal(envelope.eventType, "registration.approved");
    assert.equal(envelope.schemaVersion, SHARED_DOMAIN_EVENT_SCHEMA_VERSION);
    assert.equal(envelope.tenantId, "00000000-0000-4000-8000-000000000001");
    assert.equal(envelope.workspaceId, "denali");
    assert.equal(envelope.occurredAt, "2026-09-04T12:00:00.000Z");
    assert.equal(envelope.correlationId, "corr-1");
    assert.equal(envelope.aggregateType, "registration");
    assert.equal(envelope.aggregateId, "00000000-0000-4000-8000-000000000002");
    assert.equal(envelope.idempotencyKey, envelope.eventId);
  });

  it("findSharedDomainEventInventoryEntry resolves aliases", () => {
    const payment = findSharedDomainEventInventoryEntry("finance.ledger.double_entry_applied");
    assert.equal(payment?.canonicalEventType, "payment.confirmed");

    const tour = findSharedDomainEventInventoryEntry("tour.mutation.notification_required");
    assert.equal(tour?.canonicalEventType, "tour.schedule.changed");
  });
});
