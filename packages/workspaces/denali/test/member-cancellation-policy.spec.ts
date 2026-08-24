import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateDenaliMemberCancellationEligibility,
} from "../src/booking/member-cancellation-policy";

const DEPARTURE = "2026-09-01T08:00:00.000Z";
const NOW = "2026-08-20T12:00:00.000Z";

describe("DP4 member cancellation policy", () => {
  it("S1 pending → withdraw eligible", () => {
    const result = evaluateDenaliMemberCancellationEligibility({
      status: "pending",
      paymentStatus: "unpaid",
      departureAt: DEPARTURE,
      nowIso: NOW,
    });
    assert.equal(result.eligible, true);
    assert.equal(result.mode, "withdraw");
  });

  it("S2 waitlisted → withdraw eligible", () => {
    const result = evaluateDenaliMemberCancellationEligibility({
      status: "waitlisted",
      paymentStatus: "unpaid",
      departureAt: DEPARTURE,
      nowIso: NOW,
    });
    assert.equal(result.eligible, true);
    assert.equal(result.mode, "withdraw");
  });

  it("S3 approved unpaid → self_cancel", () => {
    const result = evaluateDenaliMemberCancellationEligibility({
      status: "approved",
      paymentStatus: "unpaid",
      departureAt: DEPARTURE,
      nowIso: NOW,
      paymentDueAt: "2026-08-21T12:00:00.000Z",
      cancellationDeadlineHours: 48,
    });
    assert.equal(result.eligible, true);
    assert.equal(result.mode, "self_cancel");
  });

  it("S4 cutoff passed → denied", () => {
    const result = evaluateDenaliMemberCancellationEligibility({
      status: "approved",
      paymentStatus: "unpaid",
      departureAt: DEPARTURE,
      nowIso: "2026-08-31T00:00:00.000Z",
      cancellationDeadlineHours: 48,
    });
    assert.equal(result.eligible, false);
    assert.equal(result.mode, "denied");
    assert.equal(result.reasonCode, "cancellation_cutoff_passed");
  });

  it("S5 paid → request only", () => {
    const result = evaluateDenaliMemberCancellationEligibility({
      status: "approved",
      paymentStatus: "paid",
      departureAt: DEPARTURE,
      nowIso: NOW,
    });
    assert.equal(result.eligible, true);
    assert.equal(result.mode, "request");
  });

  it("S5b partial → request only", () => {
    const result = evaluateDenaliMemberCancellationEligibility({
      status: "approved",
      paymentStatus: "partial",
      departureAt: DEPARTURE,
      nowIso: NOW,
    });
    assert.equal(result.eligible, true);
    assert.equal(result.mode, "request");
  });

  it("terminal cancelled → denied", () => {
    const result = evaluateDenaliMemberCancellationEligibility({
      status: "cancelled",
      paymentStatus: "unpaid",
      departureAt: DEPARTURE,
      nowIso: NOW,
    });
    assert.equal(result.eligible, false);
    assert.equal(result.reasonCode, "terminal_state");
  });
});
