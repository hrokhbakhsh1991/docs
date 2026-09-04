/**
 * TKT-001 Phase 2 — validation tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertMemberCannotForgeVisibility,
  parseTicketPriority,
  parseTicketStatus,
  validateBody,
  validateCategoryCode,
  validateSubject,
} from "../src/index";

describe("ticketing-core validation", () => {
  it("rejects invalid status and priority", () => {
    assert.equal(parseTicketStatus("new").ok, false);
    assert.equal(parseTicketPriority("critical").ok, false);
  });

  it("rejects invalid categoryCode", () => {
    assert.equal(validateCategoryCode("Billing").ok, false);
    assert.equal(validateCategoryCode("پرداخت").ok, false);
    assert.equal(validateCategoryCode("a").ok, false);
  });

  it("rejects empty subject and body", () => {
    assert.equal(validateSubject("  ").ok, false);
    assert.equal(validateBody("").ok, false);
  });

  it("rejects member forged visibility", () => {
    assert.equal(assertMemberCannotForgeVisibility("internal", "member").ok, false);
    assert.equal(assertMemberCannotForgeVisibility(undefined, "member").ok, true);
  });
});
