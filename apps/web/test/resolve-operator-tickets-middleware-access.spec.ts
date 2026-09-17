/**
 * Operator tickets — team roles must reach the inbox without weakening mutations.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allowsOperatorTicketsTeamRole,
  isOperatorTicketsTeamAccessPath,
} from "../src/features/tickets/resolve-operator-tickets-middleware-access";

describe("resolve-operator-tickets-middleware-access.spec.ts", () => {
  it("WEB-TICKETS-TEAM-01 matches the inbox and ticket BFF routes", () => {
    assert.equal(isOperatorTicketsTeamAccessPath("/tickets"), true);
    assert.equal(isOperatorTicketsTeamAccessPath("/tickets/abc"), true);
    assert.equal(isOperatorTicketsTeamAccessPath("/api/tickets/abc"), true);
    assert.equal(isOperatorTicketsTeamAccessPath("/tours"), false);
  });

  it("WEB-TICKETS-TEAM-02 keeps viewer access read-only", () => {
    assert.equal(allowsOperatorTicketsTeamRole("viewer", "GET"), true);
    assert.equal(allowsOperatorTicketsTeamRole("viewer", "HEAD"), true);
    assert.equal(allowsOperatorTicketsTeamRole("viewer", "POST"), false);
    assert.equal(allowsOperatorTicketsTeamRole("viewer", "PATCH"), false);
    assert.equal(allowsOperatorTicketsTeamRole("admin", "POST"), true);
    assert.equal(allowsOperatorTicketsTeamRole("owner", "PATCH"), true);
    assert.equal(allowsOperatorTicketsTeamRole("member", "GET"), false);
  });
});
