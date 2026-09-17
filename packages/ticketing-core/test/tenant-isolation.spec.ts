/**
 * TKT-001 Phase 2 — tenant isolation tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertTicketTenantMatch,
  assignTicket,
  canReadTicket,
} from "../src/index";
import { actor, ADMIN_A, MEMBER_B, TENANT_B, ticket } from "./helpers";

describe("ticketing-core tenant isolation", () => {
  it("denies reading ticket from another tenant", () => {
    const foreign = ticket({ tenantId: TENANT_B });
    assert.equal(canReadTicket(foreign, actor("admin")), false);
    assert.equal(assertTicketTenantMatch(foreign, actor("admin").tenantId).ok, false);
  });

  it("rejects assignee outside tenant membership", () => {
    const t = ticket();
    const result = assignTicket({
      eventId: "evt-1",
      ticket: t,
      assigneeUserId: MEMBER_B,
      actor: actor("admin", { tenantMemberUserIds: [ADMIN_A] }),
      expectedRowVersion: 1,
      nowIso: "2026-09-03T12:00:00.000Z",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "ASSIGNEE_NOT_IN_TENANT");
    }
  });

  it("rejects actor without tenant context", () => {
    const t = ticket();
    assert.equal(assertTicketTenantMatch(t, "").ok, false);
    assert.equal(canReadTicket(t, actor("member", { tenantId: "" })), false);
  });

  it("requires ticket entity for mutation — no ticketId-only helper", () => {
    const result = assignTicket({
      eventId: "evt-2",
      ticket: ticket({ rowVersion: 2 }),
      assigneeUserId: ADMIN_A,
      actor: actor("admin"),
      expectedRowVersion: 1,
      nowIso: "2026-09-03T12:00:00.000Z",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "ROW_VERSION_CONFLICT");
  });
});
