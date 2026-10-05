/**
 * DP-2 domain — operational roster semantics matrix.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveFinancialDisplayState,
  deriveRefundDisplayState,
  isDriverOffer,
  isFinalParticipant,
  isFinanciallySettled,
  isOperationalParticipant,
  isPaymentDeadlineExpiringSoon,
  isWaitlisted,
  occupiesCapacity,
  passengerAssignmentStatus,
} from "../src/roster/operational-roster-semantics.ts";

describe("DP-2 operational roster semantics", () => {
  it("approved unpaid reserves capacity but is not final until explicit finalization", () => {
    assert.equal(isOperationalParticipant("approved"), true);
    assert.equal(isFinanciallySettled("1000"), false);
    assert.equal(
      isFinalParticipant({ status: "approved", finalizationStatus: "not_final" }),
      false
    );
    assert.equal(occupiesCapacity("approved"), true);
  });

  it("finalized unpaid remains final without settlement", () => {
    assert.equal(
      isFinalParticipant({
        status: "approved",
        finalizationStatus: "finalized",
      }),
      true
    );
  });

  it("keeps final roster membership bounded by lifecycle and explicit finalization", () => {
    const cases = [
      {
        name: "explicit not_final approved participant",
        input: { status: "approved" as const, finalizationStatus: "not_final" as const },
        expected: false,
      },
      {
        name: "legacy settled row",
        input: { status: "approved" as const, finalizationStatus: "finalized" as const },
        expected: true,
      },
      {
        name: "legacy unpaid approved participant",
        input: { status: "approved" as const, finalizationStatus: "not_final" as const },
        expected: false,
      },
      {
        name: "waitlisted stale finalized metadata",
        input: {
          status: "waitlisted" as const,
          finalizationStatus: "finalized" as const,
        },
        expected: false,
      },
      {
        name: "cancelled stale finalized metadata",
        input: {
          status: "cancelled" as const,
          finalizationStatus: "finalized" as const,
        },
        expected: false,
      },
    ];

    for (const testCase of cases) {
      assert.equal(isFinalParticipant(testCase.input), testCase.expected, testCase.name);
    }
  });

  it("partial payment display state", () => {
    assert.equal(
      deriveFinancialDisplayState({
        status: "approved",
        remainingMinor: "500000",
        paidMinor: "200000",
      }),
      "PARTIALLY_PAID"
    );
  });

  it("paid final participant", () => {
    assert.equal(
      deriveFinancialDisplayState({
        status: "approved",
        remainingMinor: "0",
        paidMinor: "2500000",
      }),
      "PAID"
    );
    assert.equal(
      isFinalParticipant({ status: "approved", finalizationStatus: "finalized" }),
      true
    );
  });

  it("waived free registration", () => {
    assert.equal(
      deriveFinancialDisplayState({
        status: "approved",
        remainingMinor: "0",
        paidMinor: "0",
        waived: true,
      }),
      "WAIVED"
    );
    assert.equal(
      isFinalParticipant({ status: "approved", finalizationStatus: "finalized" }),
      true
    );
  });

  it("waitlisted does not occupy capacity", () => {
    assert.equal(isWaitlisted("waitlisted"), true);
    assert.equal(isOperationalParticipant("waitlisted"), false);
    assert.equal(occupiesCapacity("waitlisted"), false);
  });

  it("cancelled and expired do not appear operational", () => {
    assert.equal(isOperationalParticipant("cancelled"), false);
    assert.equal(occupiesCapacity("cancelled"), false);
    assert.equal(
      deriveFinancialDisplayState({
        status: "cancelled",
        remainingMinor: "1000",
        paidMinor: "0",
      }),
      "NOT_APPLICABLE"
    );
  });

  it("refund display states", () => {
    assert.equal(deriveRefundDisplayState([]), "none");
    assert.equal(deriveRefundDisplayState(["Requested"]), "in_flight");
    assert.equal(deriveRefundDisplayState(["Approved"]), "in_flight");
    assert.equal(deriveRefundDisplayState(["Completed"]), "completed");
  });

  it("driver offer from personal_car transport", () => {
    assert.equal(isDriverOffer("personal_car"), true);
    assert.equal(isDriverOffer("primary"), false);
  });

  it("passenger assignment not implemented", () => {
    assert.equal(passengerAssignmentStatus(), "not_implemented");
  });

  it("expiring deadline within window", () => {
    const now = "2026-08-24T12:00:00.000Z";
    assert.equal(
      isPaymentDeadlineExpiringSoon({
        paymentDueAt: "2026-08-24T20:00:00.000Z",
        nowIso: now,
        withinHours: 24,
      }),
      true
    );
    assert.equal(
      isPaymentDeadlineExpiringSoon({
        paymentDueAt: "2026-08-26T12:00:00.000Z",
        nowIso: now,
        withinHours: 24,
      }),
      false
    );
  });
});
