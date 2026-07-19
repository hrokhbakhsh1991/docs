/**
 * Phase B1.7 — Booking event ownership (capability-owned approve outbox event type).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { BOOKING_APPROVE_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";

import {
  isWorkspaceBookingEventReactionRegistered,
  resolveWorkspaceBookingEventReaction,
} from "./booking-event-reaction-registry.ts";
import {
  isBookingEventReactionBindingRegistered,
  WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS,
} from "./workspace-booking-event-reaction-bindings.generated.ts";

const here = dirname(fileURLToPath(import.meta.url));
const apiSrc = join(here, "..");

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

describe("BK-B1.7 booking event ownership", () => {
  it("Denali and booking-ws2 both registered with distinct adapters, stable event type", () => {
    assert.equal(isBookingEventReactionBindingRegistered("denali"), true);
    assert.equal(isBookingEventReactionBindingRegistered("booking-ws2"), true);
    assert.equal(isWorkspaceBookingEventReactionRegistered("denali"), true);
    assert.equal(isWorkspaceBookingEventReactionRegistered("booking-ws2"), true);

    const denali = resolveWorkspaceBookingEventReaction("denali");
    const ws2 = resolveWorkspaceBookingEventReaction("booking-ws2");
    assert.equal(denali.approveOutboxEventType, BOOKING_APPROVE_OUTBOX_EVENT_TYPE);
    assert.equal(ws2.approveOutboxEventType, BOOKING_APPROVE_OUTBOX_EVENT_TYPE);
    assert.equal(denali.constructor.name, "DenaliBookingEventReactionAdapter");
    assert.equal(ws2.constructor.name, "BookingWs2EventReactionAdapter");
    assert.notEqual(denali.constructor.name, ws2.constructor.name);

    assert.ok("denali" in WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS);
    assert.ok("booking-ws2" in WORKSPACE_BOOKING_EVENT_REACTION_BINDINGS);
  });

  it("unregistered workspaceType fails closed", () => {
    assert.throws(
      () => resolveWorkspaceBookingEventReaction("urban"),
      /BOOKING_EVENT_REACTION_UNSUPPORTED/
    );
    assert.equal(isWorkspaceBookingEventReactionRegistered("urban"), false);
  });

  it("generated bindings import workspace host/booking adapters", () => {
    const src = readRel("workspace-booking-event-reaction-bindings.generated.ts");
    assert.match(src, /AUTO-GENERATED/);
    assert.match(src, /DenaliBookingEventReactionAdapter/);
    assert.match(src, /BookingWs2EventReactionAdapter/);
    assert.match(src, /@app-tour\/workspace-denali\/host\/booking/);
    assert.match(src, /@app-tour\/workspace-booking-ws2\/host\/booking/);
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

  it("BookingsService uses injected eventReaction — not a hardcoded APPROVE_OUTBOX_EVENT const", () => {
    const src = readRel("bookings.service.ts");
    assert.doesNotMatch(src, /APPROVE_OUTBOX_EVENT\s*=/);
    assert.match(src, /this\.eventReaction\.approveOutboxEventType/);
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
});
