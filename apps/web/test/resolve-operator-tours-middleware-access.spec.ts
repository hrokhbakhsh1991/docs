/**
 * Operator tours — viewer read-only middleware access (parity with tickets team panel).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allowsOperatorToursTeamRole,
  isOperatorToursTeamAccessPath,
} from "../src/features/tours/resolve-operator-tours-middleware-access";

describe("resolve-operator-tours-middleware-access.spec.ts", () => {
  it("WEB-TOURS-TEAM-01 matches tours pages and BFF routes", () => {
    assert.equal(isOperatorToursTeamAccessPath("/tours"), true);
    assert.equal(isOperatorToursTeamAccessPath("/tours/new"), true);
    assert.equal(isOperatorToursTeamAccessPath("/tours/abc/edit"), true);
    assert.equal(isOperatorToursTeamAccessPath("/api/tours/abc"), true);
    assert.equal(isOperatorToursTeamAccessPath("/tickets"), false);
  });

  it("WEB-TOURS-TEAM-02 viewer is read-only; owner/admin may mutate", () => {
    assert.equal(allowsOperatorToursTeamRole("viewer", "GET"), true);
    assert.equal(allowsOperatorToursTeamRole("viewer", "PATCH"), false);
    assert.equal(allowsOperatorToursTeamRole("admin", "PATCH"), true);
    assert.equal(allowsOperatorToursTeamRole("owner", "PATCH"), true);
    assert.equal(allowsOperatorToursTeamRole("member", "GET"), false);
  });
});
