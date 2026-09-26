import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatMemberRegistrationDepartureLabel,
  MEMBER_REGISTRATION_DISPLAY_TIME_ZONE,
} from "../src/me/format-member-registration-display.server";
import { resolveMemberRegistrationDetailStatus } from "../src/me/resolve-member-registration-detail-status";

describe("member registration departure display", () => {
  it("BUG-STG-035 formats the stored instant in the Denali business timezone", () => {
    const iso = "2026-10-13T04:30:00.000Z";
    const expected = new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: MEMBER_REGISTRATION_DISPLAY_TIME_ZONE,
    }).format(new Date(iso));

    assert.equal(formatMemberRegistrationDepartureLabel(iso, "fa-IR"), expected);
    assert.match(formatMemberRegistrationDepartureLabel(iso, "fa-IR"), /۸:۰۰|08:00/);
  });

  it("does not depend on the server process timezone", () => {
    const iso = "2026-10-13T04:30:00.000Z";
    const tehran = formatMemberRegistrationDepartureLabel(iso, "en-US", "Asia/Tehran");
    const utc = formatMemberRegistrationDepartureLabel(iso, "en-US", "UTC");

    assert.notEqual(tehran, utc);
    assert.match(tehran, /8:00|08:00/);
    assert.match(utc, /4:30|04:30/);
  });

  it("BUG-STG-039/072 uses booking payment projection for final detail status", () => {
    assert.equal(
      resolveMemberRegistrationDetailStatus({
        lifecycleStatus: "approved",
        paymentStatus: "unpaid",
        receiptStatus: "paid",
      }).title,
      "statusApprovedTitle"
    );
    assert.equal(
      resolveMemberRegistrationDetailStatus({
        lifecycleStatus: "approved",
        paymentStatus: "paid",
        receiptStatus: "paid",
      }).title,
      "statusPaidTitle"
    );
    assert.equal(
      resolveMemberRegistrationDetailStatus({
        lifecycleStatus: "approved",
        paymentStatus: "unpaid",
        receiptStatus: "pending",
      }).title,
      "statusReceiptPendingTitle"
    );
  });

  it("BUG-STG-080 never exposes payment status for an approved free registration", () => {
    assert.deepEqual(
      resolveMemberRegistrationDetailStatus({
        lifecycleStatus: "approved",
        paymentCollection: "free",
        paymentStatus: "paid",
        receiptStatus: "none",
      }),
      {
        tone: "complete",
        title: "statusWaivedTitle",
        body: "statusWaivedBody",
      }
    );
  });
});
