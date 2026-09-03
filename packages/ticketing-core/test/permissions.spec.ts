/**
 * TKT-001 Phase 2 — permission matrix tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertTicketPermission,
  canAddInternalNote,
  canReadTicket,
  canReplyToTicket,
  filterMessagesForMember,
} from "../src/index";
import { actor, MEMBER_B, OWNER_A, ticket } from "./helpers";

describe("ticketing-core permissions", () => {
  it("member reads own ticket only", () => {
    const own = ticket();
    const other = ticket({ requesterUserId: MEMBER_B });
    assert.equal(canReadTicket(own, actor("member")), true);
    assert.equal(canReadTicket(other, actor("member")), false);
  });

  it("viewer is read-only", () => {
    const t = ticket();
    assert.equal(canReadTicket(t, actor("viewer")), true);
    assert.equal(canReplyToTicket(t, actor("viewer")), false);
    const reply = assertTicketPermission("reply", actor("viewer"), t);
    assert.equal(reply.ok, false);
    if (!reply.ok) assert.equal(reply.error.code, "TICKET_VIEWER_READ_ONLY");
  });

  it("admin can mutate tenant ticket", () => {
    const t = ticket();
    assert.equal(canReplyToTicket(t, actor("admin")), true);
    assert.equal(canAddInternalNote(t, actor("admin")), true);
    assert.doesNotThrow(() => assertTicketPermission("assign", actor("admin"), t));
  });

  it("owner can mutate and archive", () => {
    const t = ticket({ status: "closed" });
    assert.doesNotThrow(() => assertTicketPermission("reopen", actor("owner", { userId: OWNER_A }), t));
    assert.doesNotThrow(() => assertTicketPermission("archive", actor("owner", { userId: OWNER_A }), t));
  });

  it("platform admin denied by default", () => {
    const t = ticket();
    assert.equal(canReadTicket(t, actor("platform_admin")), false);
    const read = assertTicketPermission("read", actor("platform_admin"), t);
    assert.equal(read.ok, false);
    if (!read.ok) assert.equal(read.error.code, "TICKET_ACCESS_DENIED");
  });

  it("internal notes forbidden for member and hidden from member projection", () => {
    const t = ticket();
    assert.equal(canAddInternalNote(t, actor("member")), false);
    const messages = filterMessagesForMember([
      {
        id: "m1",
        tenantId: t.tenantId,
        ticketId: t.id,
        authorUserId: actor("admin").userId,
        visibility: "public",
        body: "hello",
        createdAt: "2026-09-03T12:00:00.000Z",
      },
      {
        id: "m2",
        tenantId: t.tenantId,
        ticketId: t.id,
        authorUserId: actor("admin").userId,
        visibility: "internal",
        body: "secret",
        createdAt: "2026-09-03T12:00:01.000Z",
      },
    ]);
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.visibility, "public");
  });

  it("member cannot reopen closed ticket", () => {
    const closed = ticket({ status: "closed" });
    const reopen = assertTicketPermission("reopen", actor("member"), closed);
    assert.equal(reopen.ok, false);
    if (!reopen.ok) assert.equal(reopen.error.code, "INVALID_STATUS_TRANSITION");
  });
});
