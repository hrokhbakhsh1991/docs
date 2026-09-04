/**
 * MEG-001 — engagement-http-contracts parsing tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseEngagementListLimit,
  parseOperatorReversalBody,
  parseOptionalListCursor,
} from "../src/engagement-request.schemas";

describe("engagement-http-contracts", () => {
  it("parseEngagementListLimit defaults and caps", () => {
    assert.equal(parseEngagementListLimit(null), 20);
    assert.equal(parseEngagementListLimit("5"), 5);
    assert.equal(parseEngagementListLimit("500"), 100);
    assert.equal(parseEngagementListLimit("0"), 20);
  });

  it("parseOptionalListCursor trims empty values", () => {
    assert.equal(parseOptionalListCursor(null), undefined);
    assert.equal(parseOptionalListCursor("  "), undefined);
    assert.equal(parseOptionalListCursor("cursor-1"), "cursor-1");
  });

  it("parseOperatorReversalBody validates shape", () => {
    const body = parseOperatorReversalBody({
      originalEventId: "00000000-0000-4000-8000-000000000001",
      reason: "duplicate award correction",
    });
    assert.equal(body.reason, "duplicate award correction");
  });
});
