/**
 * TKT-001 Phase 2 — command orchestration tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addInternalNote,
  addPublicMessage,
  changeTicketStatus,
  closeTicket,
  createTicket,
  reopenTicket,
} from "../src/index";
import { actor, ADMIN_A, MEMBER_A, NOW, OWNER_A, TICKET_ID, ticket } from "./helpers";

describe("ticketing-core commands", () => {
  it("creates ticket in open status with events", () => {
    const result = createTicket({
      ticketId: TICKET_ID,
      messageId: "msg-1",
      eventId: "evt-1",
      tenantId: actor("member").tenantId,
      requesterUserId: MEMBER_A,
      categoryCode: "billing",
      subject: "Payment issue",
      body: "Charged twice",
      actor: actor("member"),
      nowIso: NOW,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.ticket.status, "open");
      assert.equal(result.value.message?.visibility, "public");
      assert.equal(result.value.events.length, 2);
      assert.equal(result.value.events[0]?.eventType, "ticket.created");
    }
  });

  it("member reply from pending_member reopens to open and updates activity", () => {
    const base = ticket({ status: "pending_member", rowVersion: 2 });
    const result = addPublicMessage({
      messageId: "msg-2",
      eventId: "evt-2",
      ticket: base,
      body: "More details",
      actor: actor("member"),
      expectedRowVersion: 2,
      nowIso: "2026-09-03T12:05:00.000Z",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.ticket.status, "open");
      assert.equal(result.value.ticket.rowVersion, 3);
      assert.equal(result.value.ticket.lastActivityAt, "2026-09-03T12:05:00.000Z");
    }
  });

  it("rejects reply on closed ticket", () => {
    const result = addPublicMessage({
      messageId: "msg-3",
      eventId: "evt-3",
      ticket: ticket({ status: "closed" }),
      body: "hello",
      actor: actor("member"),
      expectedRowVersion: 1,
      nowIso: NOW,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "TICKET_CLOSED");
  });

  it("member resolved reply emits reopen event and clears resolvedAt", () => {
    const result = addPublicMessage({
      messageId: "msg-4",
      eventId: "evt-4",
      ticket: ticket({
        status: "resolved",
        resolvedAt: NOW,
        rowVersion: 4,
      }),
      body: "Still broken",
      actor: actor("member"),
      expectedRowVersion: 4,
      nowIso: "2026-09-03T12:10:00.000Z",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.ticket.status, "open");
      assert.equal(result.value.ticket.resolvedAt, null);
      assert.ok(result.value.events.some((e) => e.eventType === "ticket.reopened"));
    }
  });

  it("operator internal note succeeds for admin", () => {
    const result = addInternalNote({
      messageId: "msg-5",
      eventId: "evt-5",
      ticket: ticket(),
      body: "Escalate",
      actor: actor("admin"),
      expectedRowVersion: 1,
      nowIso: NOW,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.message?.visibility, "internal");
      assert.equal(result.value.events[0]?.eventType, "ticket.internal_note.created");
    }
  });

  it("operator resolves ticket and sets resolvedAt", () => {
    const result = changeTicketStatus({
      eventId: "evt-6",
      ticket: ticket(),
      status: "resolved",
      actor: actor("admin"),
      expectedRowVersion: 1,
      nowIso: "2026-09-03T12:15:00.000Z",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.ticket.status, "resolved");
      assert.equal(result.value.ticket.resolvedAt, "2026-09-03T12:15:00.000Z");
    }
  });

  it("operator closes ticket and sets closedAt", () => {
    const result = closeTicket({
      eventId: "evt-7",
      ticket: ticket({ status: "open" }),
      actor: actor("admin"),
      expectedRowVersion: 1,
      nowIso: "2026-09-03T12:20:00.000Z",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.ticket.status, "closed");
      assert.equal(result.value.ticket.closedAt, "2026-09-03T12:20:00.000Z");
      assert.equal(result.value.events[0]?.eventType, "ticket.closed");
    }
  });

  it("operator reopens closed ticket", () => {
    const result = reopenTicket({
      eventId: "evt-8",
      ticket: ticket({ status: "closed", closedAt: NOW, rowVersion: 5 }),
      actor: actor("owner", { userId: OWNER_A }),
      expectedRowVersion: 5,
      nowIso: "2026-09-03T12:25:00.000Z",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.ticket.status, "open");
      assert.equal(result.value.ticket.closedAt, null);
    }
  });

  it("rejects member reopen from closed", () => {
    const result = reopenTicket({
      eventId: "evt-9",
      ticket: ticket({ status: "closed", closedAt: NOW }),
      actor: actor("member"),
      expectedRowVersion: 1,
      nowIso: NOW,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "INVALID_STATUS_TRANSITION");
  });
});
