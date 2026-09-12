/**
 * TKT-001 Phase 2 — lifecycle transition tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TICKET_STATUSES,
  TicketLifecycleError,
  applyStatusTimestamps,
  canTransitionTicketStatus,
  getAllowedTicketTransitions,
  resolveMemberMessageTargetStatus,
  transitionTicketStatus,
} from "../src/index";

describe("ticketing-core lifecycle", () => {
  const allowed: Array<[string, string, string]> = [
    ["open", "pending_member", "operator"],
    ["open", "resolved", "operator"],
    ["open", "closed", "operator"],
    ["pending_member", "open", "member"],
    ["pending_member", "open", "operator"],
    ["pending_member", "resolved", "operator"],
    ["pending_member", "closed", "operator"],
    ["resolved", "open", "member"],
    ["resolved", "open", "operator"],
    ["resolved", "pending_member", "operator"],
    ["resolved", "closed", "operator"],
    ["closed", "open", "operator"],
    ["closed", "open", "owner"],
  ];

  for (const [from, to, actor] of allowed) {
    it(`allows ${from} → ${to} for ${actor}`, () => {
      assert.equal(
        canTransitionTicketStatus(
          from as (typeof TICKET_STATUSES)[number],
          to as (typeof TICKET_STATUSES)[number],
          actor as "member" | "operator" | "owner",
        ),
        true,
      );
      assert.equal(
        transitionTicketStatus(
          from as (typeof TICKET_STATUSES)[number],
          to as (typeof TICKET_STATUSES)[number],
          actor as "member" | "operator" | "owner",
        ),
        to,
      );
    });
  }

  const denied: Array<[string, string, string]> = [
    ["open", "open", "operator"],
    ["closed", "open", "member"],
    ["closed", "resolved", "operator"],
    ["resolved", "closed", "member"],
    ["open", "closed", "member"],
  ];

  for (const [from, to, actor] of denied) {
    it(`rejects ${from} → ${to} for ${actor}`, () => {
      assert.equal(
        canTransitionTicketStatus(
          from as (typeof TICKET_STATUSES)[number],
          to as (typeof TICKET_STATUSES)[number],
          actor as "member" | "operator" | "owner",
        ),
        false,
      );
      assert.throws(
        () =>
          transitionTicketStatus(
            from as (typeof TICKET_STATUSES)[number],
            to as (typeof TICKET_STATUSES)[number],
            actor as "member" | "operator" | "owner",
          ),
        TicketLifecycleError,
      );
    });
  }

  it("lists allowed transitions for operator from open", () => {
    const targets = getAllowedTicketTransitions("open", "operator");
    assert.deepEqual([...targets].sort(), ["closed", "pending_member", "resolved"]);
  });

  it("resolves member message target status", () => {
    assert.equal(resolveMemberMessageTargetStatus("open"), "open");
    assert.equal(resolveMemberMessageTargetStatus("pending_member"), "open");
    assert.equal(resolveMemberMessageTargetStatus("resolved"), "open");
    assert.equal(resolveMemberMessageTargetStatus("closed"), "TICKET_CLOSED");
  });

  it("sets resolvedAt and closedAt timestamps", () => {
    const base = { resolvedAt: null, closedAt: null };
    const resolved = applyStatusTimestamps(base, "resolved", NOW);
    assert.equal(resolved.resolvedAt, NOW);
    assert.equal(resolved.closedAt, null);

    const closed = applyStatusTimestamps(resolved, "closed", NOW);
    assert.equal(closed.closedAt, NOW);

    const reopened = applyStatusTimestamps(closed, "open", NOW);
    assert.equal(reopened.resolvedAt, null);
    assert.equal(reopened.closedAt, null);
  });
});

const NOW = "2026-09-03T12:00:00.000Z";
