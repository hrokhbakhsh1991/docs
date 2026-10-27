import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseTourApiErrorBody } from "../src/tours/parse-tour-api-error-body";
import { resolveCancelParticipantErrorKey } from "../src/features/tours/resolve-cancel-participant-error";

describe("resolve-cancel-participant-error", () => {
  it("maps the dong-seat dependency rejection to actionable operator copy", () => {
    const parsed = parseTourApiErrorBody({
      code: "BOOKING_DONG_SEAT_REASSIGNMENT_REQUIRED",
      error: "BOOKING_DONG_SEAT_REASSIGNMENT_REQUIRED",
      clientAction: "Reassign the passengers or add enough approved car seats before cancelling",
    });

    assert.equal(
      resolveCancelParticipantErrorKey(parsed.code),
      "cancelParticipantDongRiderReassignmentRequired"
    );
  });

  it("leaves unrelated failures on the existing generic error path", () => {
    assert.equal(resolveCancelParticipantErrorKey("BOOKING_NOT_FOUND"), null);
  });
});
