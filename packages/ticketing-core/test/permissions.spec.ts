/**
 * TKT-001 Phase 2 — permission matrix tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertTicketPermission,
  canAddInternalNote,
  canAssignTicket,
  canChangeStatus,
  canListTicket,
  canReadTicket,
  canReplyToTicket,
  filterMessagesForMember,
  filterMessagesForViewer,
} from "../src/index";
import { actor, MEMBER_A, MEMBER_B, OWNER_A, TENANT_B, ticket } from "./helpers";

const VIEWER_A = "00000000-0000-4000-8000-000000000501";

describe("ticketing-core permissions", () => {
  it("member reads own ticket only", () => {
    const own = ticket();
    const other = ticket({ requesterUserId: MEMBER_B });
    assert.equal(canReadTicket(own, actor("member")), true);
    assert.equal(canReadTicket(other, actor("member")), false);
  });

  it("viewer can list tickets in own tenant", () => {
    assert.equal(
      canListTicket(actor("viewer", { userId: VIEWER_A }), "tenant"),
      true,
    );
    assert.equal(
      assertTicketPermission("list", actor("viewer", { userId: VIEWER_A }), undefined, {
        listScope: "tenant",
      }).ok,
      true,
    );
  });

  it("viewer can read another member ticket in own tenant", () => {
    const otherMemberTicket = ticket({ requesterUserId: MEMBER_B });
    assert.equal(
      canReadTicket(
        otherMemberTicket,
        actor("viewer", { userId: VIEWER_A, tenantMemberUserIds: [VIEWER_A, MEMBER_A, MEMBER_B] }),
      ),
      true,
    );
  });

  it("viewer cannot read ticket in another tenant", () => {
    const foreign = ticket({ tenantId: TENANT_B });
    assert.equal(
      canReadTicket(foreign, actor("viewer", { userId: VIEWER_A })),
      false,
    );
  });

  it("viewer cannot mutate ticket", () => {
    const t = ticket();
    const viewer = actor("viewer", { userId: VIEWER_A });
    assert.equal(canReplyToTicket(t, viewer), false);
    assert.equal(canAddInternalNote(t, viewer), false);
    assert.equal(canAssignTicket(t, viewer), false);
    assert.equal(canChangeStatus(t, viewer, "closed"), false);
    const create = assertTicketPermission("create", viewer);
    assert.equal(create.ok, false);
    if (!create.ok) assert.equal(create.error.code, "TICKET_VIEWER_READ_ONLY");
  });

  it("viewer cannot add public reply", () => {
    const t = ticket();
    const reply = assertTicketPermission("reply", actor("viewer", { userId: VIEWER_A }), t);
    assert.equal(reply.ok, false);
    if (!reply.ok) assert.equal(reply.error.code, "TICKET_VIEWER_READ_ONLY");
  });

  it("viewer cannot add internal note", () => {
    const t = ticket();
    const note = assertTicketPermission("internal_note", actor("viewer", { userId: VIEWER_A }), t);
    assert.equal(note.ok, false);
    if (!note.ok) assert.equal(note.error.code, "TICKET_VIEWER_READ_ONLY");
  });

  it("viewer cannot change status", () => {
    const t = ticket();
    const status = assertTicketPermission("change_status", actor("viewer", { userId: VIEWER_A }), t, {
      toStatus: "closed",
    });
    assert.equal(status.ok, false);
    if (!status.ok) assert.equal(status.error.code, "TICKET_VIEWER_READ_ONLY");
  });

  it("viewer cannot assign ticket", () => {
    const t = ticket();
    const assign = assertTicketPermission("assign", actor("viewer", { userId: VIEWER_A }), t);
    assert.equal(assign.ok, false);
    if (!assign.ok) assert.equal(assign.error.code, "TICKET_VIEWER_READ_ONLY");
  });

  it("viewer without tenant membership is denied", () => {
    const t = ticket();
    const viewer = actor("viewer", {
      userId: VIEWER_A,
      tenantMemberUserIds: [MEMBER_A, MEMBER_B],
    });
    assert.equal(canReadTicket(t, viewer), false);
    assert.equal(canListTicket(viewer, "tenant"), false);
  });

  it("viewer sees internal notes in read projection", () => {
    const messages = [
      {
        id: "m1",
        tenantId: ticket().tenantId,
        ticketId: ticket().id,
        authorUserId: actor("admin").userId,
        visibility: "public" as const,
        body: "hello",
        createdAt: "2026-09-03T12:00:00.000Z",
      },
      {
        id: "m2",
        tenantId: ticket().tenantId,
        ticketId: ticket().id,
        authorUserId: actor("admin").userId,
        visibility: "internal" as const,
        body: "secret",
        createdAt: "2026-09-03T12:00:01.000Z",
      },
    ];
    assert.equal(filterMessagesForMember(messages).length, 1);
    assert.equal(filterMessagesForViewer(messages).length, 2);
  });

  it("admin can mutate tenant ticket", () => {
    const t = ticket();
    assert.equal(canReplyToTicket(t, actor("admin")), true);
    assert.equal(canAddInternalNote(t, actor("admin")), true);
    assert.equal(assertTicketPermission("assign", actor("admin"), t).ok, true);
  });

  it("owner can mutate and archive", () => {
    const t = ticket({ status: "closed" });
    assert.equal(
      assertTicketPermission("reopen", actor("owner", { userId: OWNER_A }), t).ok,
      true,
    );
    assert.equal(
      assertTicketPermission("archive", actor("owner", { userId: OWNER_A }), t).ok,
      true,
    );
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
