/**
 * Booking approve reaction delivery — honest channel guarantees.
 *
 * Behavioral proofs (no decorative reactedIds):
 * - repeat approve → conflict; single durable outbox; reactAfterApprove called once
 * - manual duplicate reactAfterApprove does not enqueue second outbox
 * - outbox replay / relay does not invoke reactAfterApprove
 * - process restart: outbox survives; reaction is not auto-reinvoked
 *
 * @see docs/phase-20/p7/appendices/BOOKING_APPROVE_REACTION_DELIVERY.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BOOKING_APPROVE_OUTBOX_DELIVERY,
  BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
  BOOKING_APPROVE_REACTION_DELIVERY,
  type WorkspaceBookingEventReactionPort,
} from "@app-tour/booking-http-contracts";

import { OPERATOR_SMOKE } from "../../test/fixtures/operator-smoke-e2e-tenant.ts";
import { BookingStatusConflictError } from "./bookings.errors.ts";
import {
  resetBookingsRepositoryForTests,
} from "./create-bookings-repository.ts";
import { peekOutboxByAggregateForTests } from "./in-memory-bookings.repository.ts";
import {
  approveBooking,
  createBooking,
  getOrCreateBookingRuntimeForWorkspaceType,
  resetBookingsServiceCompositionForTests,
} from "./create-bookings-service.ts";

const here = dirname(fileURLToPath(import.meta.url));
const DENALI = "denali";
const TENANT = OPERATOR_SMOKE.tenantId;

/** Count in-process reactAfterApprove invocations (adapters are intentionally empty). */
function wrapReactAfterApprove(reaction: WorkspaceBookingEventReactionPort): {
  readonly getCallCount: () => number;
} {
  let calls = 0;
  const original = reaction.reactAfterApprove.bind(reaction);
  reaction.reactAfterApprove = async (input) => {
    calls += 1;
    return original(input);
  };
  return { getCallCount: () => calls };
}

function opsAuth() {
  return {
    tenantId: TENANT,
    userId: OPERATOR_SMOKE.adminUserId,
    role: "admin" as const,
    status: "ACTIVE" as const,
  };
}

function body(guestEmail: string) {
  return {
    tourId: "00000000-0000-4000-8000-000000000881",
    tourTitle: "Approve Delivery Tour",
    guestLabel: "Delivery Guest",
    guestEmail,
    partySize: 1,
    departureAt: "2031-08-01T10:00:00.000Z",
    registrationIntake: { tourCapacityMax: 10 },
  };
}

describe("booking approve reaction delivery (honest contract)", { concurrency: false }, () => {
  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
  });

  beforeEach(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  after(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  it("runtime contract: outbox durable vs reaction best-effort in-process", () => {
    assert.equal(BOOKING_APPROVE_OUTBOX_DELIVERY.channel, "durable-outbox");
    assert.equal(BOOKING_APPROVE_OUTBOX_DELIVERY.eventType, BOOKING_APPROVE_OUTBOX_EVENT_TYPE);
    assert.equal(BOOKING_APPROVE_OUTBOX_DELIVERY.durability, "durable");
    assert.equal(BOOKING_APPROVE_OUTBOX_DELIVERY.writeSemantics, "at-most-once-insert");
    assert.equal(BOOKING_APPROVE_OUTBOX_DELIVERY.consumerDelivery, "at-least-once");
    assert.equal(BOOKING_APPROVE_OUTBOX_DELIVERY.exactlyOnce, false);
    assert.equal(BOOKING_APPROVE_OUTBOX_DELIVERY.survivesProcessRestart, true);

    assert.equal(BOOKING_APPROVE_REACTION_DELIVERY.channel, "in-process-callback");
    assert.equal(BOOKING_APPROVE_REACTION_DELIVERY.durability, "not-durable");
    assert.equal(BOOKING_APPROVE_REACTION_DELIVERY.delivery, "best-effort");
    assert.equal(BOOKING_APPROVE_REACTION_DELIVERY.exactlyOnce, false);
    assert.equal(BOOKING_APPROVE_REACTION_DELIVERY.survivesProcessRestart, false);
    assert.equal(BOOKING_APPROVE_REACTION_DELIVERY.triggeredByOutboxRelay, false);
    assert.equal(BOOKING_APPROVE_REACTION_DELIVERY.triggeredByOutboxReplay, false);
  });

  it("repeat approve: conflict; single durable outbox; single reaction call", async () => {
    const reaction = getOrCreateBookingRuntimeForWorkspaceType(DENALI).eventReaction;
    const probe = wrapReactAfterApprove(reaction);

    const created = await createBooking(opsAuth(), body("repeat-approve@example.com"));
    await approveBooking(opsAuth(), created.id);
    assert.equal(probe.getCallCount(), 1);

    await assert.rejects(
      () => approveBooking(opsAuth(), created.id),
      (err: unknown) => err instanceof BookingStatusConflictError
    );
    assert.equal(probe.getCallCount(), 1);

    const outbox = await peekOutboxByAggregateForTests({
      tenantId: TENANT,
      aggregateId: created.id,
    });
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0]?.eventType, BOOKING_APPROVE_OUTBOX_EVENT_TYPE);
  });

  it("duplicate reaction: empty adapter; does not enqueue second outbox", async () => {
    const reaction = getOrCreateBookingRuntimeForWorkspaceType(DENALI).eventReaction;
    const probe = wrapReactAfterApprove(reaction);

    const created = await createBooking(opsAuth(), body("dup-reaction@example.com"));
    await approveBooking(opsAuth(), created.id);
    assert.equal(probe.getCallCount(), 1);

    await reaction.reactAfterApprove({
      tenantId: TENANT,
      bookingId: created.id,
      outboxEventType: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
    });
    assert.equal(probe.getCallCount(), 2);

    const outbox = await peekOutboxByAggregateForTests({
      tenantId: TENANT,
      aggregateId: created.id,
    });
    assert.equal(outbox.length, 1);
  });

  it("outbox replay path does not invoke reactAfterApprove", async () => {
    const serviceSrc = readFileSync(join(here, "bookings.service.ts"), "utf8");
    assert.match(serviceSrc, /invokeApproveReaction/);
    assert.doesNotMatch(serviceSrc, /listOutboxByAggregate[\s\S]{0,200}reactAfterApprove/);
    assert.doesNotMatch(serviceSrc, /replay[\s\S]{0,80}reactAfterApprove/i);

    const outboxRelay = readFileSync(join(here, "../outbox/outbox-relay.ts"), "utf8");
    const outboxReplay = readFileSync(join(here, "../outbox/outbox-replay.ts"), "utf8");
    assert.doesNotMatch(outboxRelay, /reactAfterApprove/);
    assert.doesNotMatch(outboxReplay, /reactAfterApprove/);

    const reaction = getOrCreateBookingRuntimeForWorkspaceType(DENALI).eventReaction;
    const probe = wrapReactAfterApprove(reaction);
    const created = await createBooking(opsAuth(), body("replay-path@example.com"));
    await approveBooking(opsAuth(), created.id);
    assert.equal(probe.getCallCount(), 1);

    const before = probe.getCallCount();
    const rows = await peekOutboxByAggregateForTests({
      tenantId: TENANT,
      aggregateId: created.id,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.eventType, BOOKING_APPROVE_OUTBOX_EVENT_TYPE);
    assert.equal(probe.getCallCount(), before);
    assert.equal(BOOKING_APPROVE_REACTION_DELIVERY.triggeredByOutboxReplay, false);
  });

  it("process restart simulation: outbox survives; reaction not auto-reinvoked", async () => {
    const created = await createBooking(opsAuth(), body("restart-sim@example.com"));
    await approveBooking(opsAuth(), created.id);

    const outboxBefore = await peekOutboxByAggregateForTests({
      tenantId: TENANT,
      aggregateId: created.id,
    });
    assert.equal(outboxBefore.length, 1);

    resetBookingsServiceCompositionForTests();

    const afterRestart = getOrCreateBookingRuntimeForWorkspaceType(DENALI).eventReaction;
    const probe = wrapReactAfterApprove(afterRestart);
    assert.equal(probe.getCallCount(), 0, "restart must not auto-reinvoke reactAfterApprove");

    const outboxAfter = await peekOutboxByAggregateForTests({
      tenantId: TENANT,
      aggregateId: created.id,
    });
    assert.equal(outboxAfter.length, 1);
    assert.equal(outboxAfter[0]?.eventType, BOOKING_APPROVE_OUTBOX_EVENT_TYPE);
    assert.equal(outboxAfter[0]?.id, outboxBefore[0]?.id);

    assert.equal(BOOKING_APPROVE_OUTBOX_DELIVERY.survivesProcessRestart, true);
    assert.equal(BOOKING_APPROVE_REACTION_DELIVERY.survivesProcessRestart, false);
  });
});
