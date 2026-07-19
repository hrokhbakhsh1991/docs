/**
 * Phase B1.7 — close event reaction ownership (WHEN application / WHAT adapter).
 *
 * Proofs (no decorative reactionToken / reactedIds):
 * - Denali approve invokes Denali reactAfterApprove once + writes outbox
 * - ws2 approve invokes ws2 reactAfterApprove once (distinct kind)
 * - repeated reactAfterApprove does not enqueue a second outbox
 * - unsupported workspace cannot approve
 */
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
  type WorkspaceBookingEventReactionPort,
} from "@app-tour/booking-http-contracts";

import { OPERATOR_SMOKE } from "../../test/fixtures/operator-smoke-e2e-tenant.ts";
import { BookingWorkspaceUnsupportedError } from "./bookings.errors.ts";
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
import { resolveWorkspaceBookingEventReaction } from "./booking-event-reaction-registry.ts";
import { WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS } from "./workspace-booking-event-reaction-bindings.generated.ts";

const here = dirname(fileURLToPath(import.meta.url));
const apiSrc = join(here, "..");

const DENALI = "denali";
const WS2 = "booking-ws2";
const TENANT_DENALI = OPERATOR_SMOKE.tenantId;
const TENANT_WS2 = "00000000-0000-4000-8000-000000000015";
const TENANT_URBAN = "00000000-0000-4000-8000-000000000004";

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

const CREATE_BODY = {
  tourId: "00000000-0000-4000-8000-000000000880",
  tourTitle: "B1.7 Reaction Tour",
  guestLabel: "Reaction Guest",
  guestEmail: "b17-reaction@example.com",
  guestPhone: "+15550004444",
  partySize: 1,
  departureAt: "2026-10-01T10:00:00.000Z",
  registrationIntake: { tourCapacityMax: 10 },
};

function opsAuth(tenantId: string) {
  return {
    tenantId,
    userId: OPERATOR_SMOKE.adminUserId,
    role: "admin" as const,
    status: "ACTIVE" as const,
  };
}

function readRel(rel: string): string {
  return readFileSync(join(here, rel), "utf8");
}

function assertNoWorkspacePackageImports(src: string, label: string): void {
  assert.doesNotMatch(
    src,
    /@app-tour\/workspace-/,
    `${label} must not import @app-tour/workspace-* packages`
  );
}

describe("BK-B1.7 booking event ownership", { concurrency: false }, () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorDatabaseUrl = process.env.DATABASE_URL;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
    if (priorDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = priorDatabaseUrl;
    }
  });

  beforeEach(() => {
    resetBookingsRepositoryForTests();
    resetBookingsServiceCompositionForTests();
  });

  it("Denali and booking-ws2 both resolve with distinct adapters, stable event type", () => {
    assert.ok("denali" in WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS);
    assert.ok("booking-ws2" in WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS);

    const denali = resolveWorkspaceBookingEventReaction("denali");
    const ws2 = resolveWorkspaceBookingEventReaction("booking-ws2");
    assert.equal(denali.approveOutboxEventType, BOOKING_APPROVE_OUTBOX_EVENT_TYPE);
    assert.equal(ws2.approveOutboxEventType, BOOKING_APPROVE_OUTBOX_EVENT_TYPE);
    assert.equal(denali.constructor.name, "DenaliBookingEventReactionAdapter");
    assert.equal(ws2.constructor.name, "BookingWs2EventReactionAdapter");
    assert.equal(denali.kind, "denali-booking-event-reaction");
    assert.equal(ws2.kind, "booking-ws2-event-reaction");
    assert.notEqual(denali.kind, ws2.kind);
  });

  it("unregistered workspaceType fails closed", () => {
    assert.throws(
      () => resolveWorkspaceBookingEventReaction("urban"),
      /BOOKING_EVENT_REACTION_UNSUPPORTED/
    );
  });

  it("generated bindings import workspace host/booking adapters", () => {
    const src = readRel("workspace-booking-event-reaction-bindings.generated.ts");
    assert.match(src, /AUTO-GENERATED/);
    assert.match(src, /DenaliBookingEventReactionAdapter/);
    assert.match(src, /BookingWs2EventReactionAdapter/);
    assert.ok(src.includes("@app-tour/workspace-denali/host/booking"));
    assert.ok(src.includes("@app-tour/workspace-booking-ws2/host/booking"));
  });

  it("hand-written registry has no direct workspace package imports", () => {
    assertNoWorkspacePackageImports(readRel("booking-event-reaction-registry.ts"), "registry");
    assert.match(
      readRel("booking-event-reaction-registry.ts"),
      /workspace-booking-event-reaction-bindings\.generated/
    );
  });

  it("event runtime (service, repos, enqueue, relay) has no workspace package imports", () => {
    const runtimeFiles = [
      join(here, "bookings.service.ts"),
      join(here, "prisma-bookings.repository.ts"),
      join(here, "in-memory-bookings.repository.ts"),
      join(here, "bookings-outbox-projection.ts"),
      join(here, "create-bookings-repository.ts"),
      join(apiSrc, "outbox/enqueue-domain-event.ts"),
      join(apiSrc, "outbox/outbox-relay.ts"),
    ];
    for (const file of runtimeFiles) {
      assertNoWorkspacePackageImports(readFileSync(file, "utf8"), file);
    }
  });

  it("BookingsService invokes reactAfterApprove after approve TX (no dead binding)", () => {
    const src = readRel("bookings.service.ts");
    assert.doesNotMatch(src, /APPROVE_OUTBOX_EVENT\s*=/);
    assert.match(src, /this\.eventReaction\.approveOutboxEventType/);
    assert.match(src, /invokeApproveReaction/);
    assert.match(src, /this\.eventReaction\.reactAfterApprove/);
    const approveBlock = src.slice(
      src.indexOf("async approveBooking("),
      src.indexOf("async rejectBooking(")
    );
    assert.match(approveBlock, /approveWithOutbox[\s\S]*invokeApproveReaction/);
  });

  it("composition + registry event path has no workspace package imports", () => {
    assertNoWorkspacePackageImports(
      readRel("create-bookings-service.ts"),
      "create-bookings-service"
    );
    assertNoWorkspacePackageImports(
      readRel("booking-event-reaction-registry.ts"),
      "booking-event-reaction-registry"
    );
  });

  it("Denali approve triggers Denali reaction (WHAT owned by adapter)", async () => {
    const runtime = getOrCreateBookingRuntimeForWorkspaceType(DENALI);
    const reaction = runtime.eventReaction;
    assert.equal(reaction.kind, "denali-booking-event-reaction");
    const probe = wrapReactAfterApprove(reaction);

    const created = await createBooking(opsAuth(TENANT_DENALI), CREATE_BODY);
    const approved = await approveBooking(opsAuth(TENANT_DENALI), created.id);
    assert.equal(approved.status, "approved");
    assert.equal(probe.getCallCount(), 1);

    const outbox = await peekOutboxByAggregateForTests({
      tenantId: TENANT_DENALI,
      aggregateId: created.id,
    });
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0]?.eventType, BOOKING_APPROVE_OUTBOX_EVENT_TYPE);
  });

  it("ws2 approve triggers ws2 reaction (distinct WHAT)", async () => {
    const runtime = getOrCreateBookingRuntimeForWorkspaceType(WS2);
    const reaction = runtime.eventReaction;
    assert.equal(reaction.kind, "booking-ws2-event-reaction");
    const probe = wrapReactAfterApprove(reaction);

    const created = await createBooking(opsAuth(TENANT_WS2), {
      ...CREATE_BODY,
      guestEmail: "b17-ws2@example.com",
    });
    await approveBooking(opsAuth(TENANT_WS2), created.id);
    assert.equal(probe.getCallCount(), 1);
    assert.notEqual(reaction.kind, "denali-booking-event-reaction");
  });

  it("repeated reactAfterApprove does not enqueue a second outbox", async () => {
    const runtime = getOrCreateBookingRuntimeForWorkspaceType(DENALI);
    const reaction = runtime.eventReaction;
    const probe = wrapReactAfterApprove(reaction);

    const created = await createBooking(opsAuth(TENANT_DENALI), {
      ...CREATE_BODY,
      guestEmail: "b17-idempotent@example.com",
    });
    await approveBooking(opsAuth(TENANT_DENALI), created.id);
    assert.equal(probe.getCallCount(), 1);

    await reaction.reactAfterApprove({
      tenantId: TENANT_DENALI,
      bookingId: created.id,
      outboxEventType: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
    });
    assert.equal(probe.getCallCount(), 2);

    const outbox = await peekOutboxByAggregateForTests({
      tenantId: TENANT_DENALI,
      aggregateId: created.id,
    });
    assert.equal(outbox.length, 1, "adapter must not enqueue a second outbox row");
  });

  it("unsupported workspace cannot approve", async () => {
    await assert.rejects(
      () => approveBooking(opsAuth(TENANT_URBAN), "00000000-0000-4000-8000-000000000999"),
      (error: unknown) => error instanceof BookingWorkspaceUnsupportedError
    );
  });
});
