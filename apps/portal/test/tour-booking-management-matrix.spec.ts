/**
 * Member-portal projection matrix.
 * Unknown wire values must never become a false positive such as "paid".
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseMemberReceiptStatus } from "../src/me/member-receipt-status";
import { parseRegistrationLifecycleStatus } from "../src/me/registration-lifecycle-status";

const REGISTRATION_STATUSES = [
  "pending",
  "approved",
  "waitlisted",
  "rejected",
  "cancelled",
] as const;

const RECEIPT_STATUSES = ["none", "pending", "rejected", "paid", "waived"] as const;

describe("tour-booking-management-matrix (member portal)", () => {
  it("parses every registration lifecycle status and rejects unknown values", () => {
    for (const status of REGISTRATION_STATUSES) {
      assert.equal(parseRegistrationLifecycleStatus(status), status);
    }

    for (const unknown of ["paid", "confirmed", "", "null"]) {
      assert.equal(parseRegistrationLifecycleStatus(unknown), null, unknown);
    }
  });

  it("parses every receipt status and fails closed for unknown values", () => {
    for (const status of RECEIPT_STATUSES) {
      assert.equal(parseMemberReceiptStatus(status), status);
    }

    for (const unknown of ["approved", "confirmed", "", null, undefined, 42]) {
      assert.equal(parseMemberReceiptStatus(unknown), "none");
    }
  });
});
