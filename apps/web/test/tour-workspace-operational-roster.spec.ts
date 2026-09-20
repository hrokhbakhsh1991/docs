/**
 * DP-2 operator UI contract — tour workspace operational roster.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  OPERATIONAL_ROSTER_FILTERS,
  TOUR_WORKSPACE_TRANSPORT_TEST_IDS,
  buildTourOperationalRosterHref,
  formatOperationalRosterAmountDue,
  normalizeDriverCompensationPerSeat,
  resolveOperationalRosterActionablePaymentDueAt,
  resolveOperationalRosterNoteKind,
  resolveOperationalRosterStage,
} from "../src/features/tours/tour-workspace-transport-logic";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("DP-2 tour workspace operational roster contract", () => {
  it("normalizes valid localized seat amounts and rejects unsafe values", () => {
    assert.equal(normalizeDriverCompensationPerSeat("۵۰٬۰۰۰"), "50000");
    assert.equal(normalizeDriverCompensationPerSeat("50,000"), "50000");
    assert.equal(normalizeDriverCompensationPerSeat("-50000"), null);
    assert.equal(normalizeDriverCompensationPerSeat("50.5"), null);
    assert.equal(normalizeDriverCompensationPerSeat("0"), null);
  });
  it("transport tab loads unified operational roster endpoint", () => {
    const client = readFileSync(
      join(webRoot, "app/(app)/tours/[id]/workspace/transport/tour-workspace-transport-client.tsx"),
      "utf8"
    );
    assert.match(client, /buildTourOperationalRosterHref/);
    assert.doesNotMatch(client, /fetch\(`\/api\/bookings\?/);
  });

  it("registrations tab is scoped to pending requests while final roster stays in transport", () => {
    const client = readFileSync(
      join(webRoot, "app/(app)/tours/[id]/workspace/tour-workspace-registrations-client.tsx"),
      "utf8"
    );
    assert.match(client, /lockedStatus="pending"/);
  });

  it("localizes temporary transport roster outages", () => {
    for (const locale of ["fa", "en"]) {
      const messages = readFileSync(join(webRoot, `messages/${locale}/tours.json`), "utf8");
      assert.match(messages, /TOUR_TRANSPORT_BOOKINGS_HTTP_503/);
    }
  });

  it("labels the non-editable transport value as a status", () => {
    const faMessages = readFileSync(join(webRoot, "messages/fa/tours.json"), "utf8");
    const enMessages = readFileSync(join(webRoot, "messages/en/tours.json"), "utf8");

    assert.match(faMessages, /"transportIntake": "وضعیت حمل"/);
    assert.match(enMessages, /"transportIntake": "Transport status"/);
  });

  it("BFF proxies tour operational roster route", () => {
    const route = readFileSync(
      join(webRoot, "app/api/tours/[id]/operational-roster/route.ts"),
      "utf8"
    );
    assert.match(route, /operational-roster/);
    assert.match(route, /resolveTourOpsApiBaseUrl/);
  });

  it("exposes the final roster Excel export only from the operator transport surface", () => {
    const client = readFileSync(
      join(webRoot, "app/(app)/tours/[id]/workspace/transport/tour-workspace-transport-client.tsx"),
      "utf8"
    );
    const exportRoute = readFileSync(
      join(webRoot, "app/api/tours/[id]/operational-roster/export/route.ts"),
      "utf8"
    );
    assert.match(client, /exportFinalRosterButton/);
    assert.match(client, /canManage/);
    assert.match(client, /format=xlsx/);
    assert.match(exportRoute, /operational-roster\/export/);
  });

  it("preserves the server-provided timestamped roster filename", () => {
    const client = readFileSync(
      join(webRoot, "app/(app)/tours/[id]/workspace/transport/tour-workspace-transport-client.tsx"),
      "utf8"
    );
    assert.match(
      client,
      /readAttachmentFilename\(response\.headers\.get\("Content-Disposition"\)\)/
    );
    assert.match(client, /anchor\.download/);
    assert.match(client, /filename=\"\(\[\^\"\]\+\)\"/);
  });

  it("communicates final-roster export scope and result without a browser-download guess", () => {
    const client = readFileSync(
      join(webRoot, "app/(app)/tours/[id]/workspace/transport/tour-workspace-transport-client.tsx"),
      "utf8"
    );
    assert.match(client, /setExportSuccess\(t\("exportSucceeded"\)\)/);
    assert.match(client, /t\("exportFinalRosterScope"\)/);
    assert.match(client, /role="status"/);
  });

  it("payment follow-up list is roster-backed and does not duplicate registration approvals", () => {
    const hook = readFileSync(
      join(webRoot, "src/features/tours/use-tour-workspace-payment-follow-up-list.ts"),
      "utf8"
    );
    const load = readFileSync(
      join(webRoot, "src/features/tours/tour-workspace-payment-follow-up-load.ts"),
      "utf8"
    );
    assert.match(hook, /buildTourOperationalRosterHref/);
    assert.match(hook, /resolvePaymentFollowUpLoadOutcome/);
    assert.match(hook, /Promise\.allSettled/);
    assert.match(hook, /refreshNonce/);
    assert.match(load, /rosterDegraded/);
    assert.match(hook, /toPaymentFollowUpHttpError\("TOUR_ROSTER_HTTP"/);
    assert.doesNotMatch(hook, /buildBookingsApiQuery/);
    assert.doesNotMatch(hook, /status:\s*"pending"/);
  });

  it("renders final participant, amount due, deadline, driver badges", () => {
    const client = readFileSync(
      join(webRoot, "app/(app)/tours/[id]/workspace/transport/tour-workspace-transport-client.tsx"),
      "utf8"
    );
    assert.match(client, /TOUR_WORKSPACE_TRANSPORT_TEST_IDS\.finalBadge/);
    assert.match(client, /TOUR_WORKSPACE_TRANSPORT_TEST_IDS\.amountDue/);
    assert.match(client, /TOUR_WORKSPACE_TRANSPORT_TEST_IDS\.paymentDeadline/);
    assert.match(client, /TOUR_WORKSPACE_TRANSPORT_TEST_IDS\.driverBadge/);
    assert.match(client, /TOUR_WORKSPACE_TRANSPORT_TEST_IDS\.rowAvatar/);
    assert.match(client, /TOUR_WORKSPACE_TRANSPORT_TEST_IDS\.mobileList/);
    assert.match(client, /TourWorkspaceTransportControls/);
  });

  it("exposes approved DP-2 roster filters", () => {
    assert.deepEqual(OPERATIONAL_ROSTER_FILTERS, [
      "operational",
      "final",
      "unpaid",
      "paid",
      "expiring",
      "waitlist",
    ]);
  });

  it("amount due formatter respects financial display state", () => {
    assert.equal(
      formatOperationalRosterAmountDue({
        remainingMinor: "1000",
        currency: "IRR",
        financialDisplayState: "UNPAID",
      }),
      "1000 IRR"
    );
    assert.equal(
      formatOperationalRosterAmountDue({
        remainingMinor: "0",
        currency: "IRR",
        financialDisplayState: "PAID",
      }),
      null
    );
    assert.equal(
      formatOperationalRosterAmountDue({
        remainingMinor: "0",
        currency: "IRR",
        financialDisplayState: "WAIVED",
      }),
      null
    );
  });

  it("deadline is actionable only while payment follow-up remains open", () => {
    assert.equal(
      resolveOperationalRosterActionablePaymentDueAt({
        financialDisplayState: "UNPAID",
        paymentDueAt: "2026-08-30T00:00:00.000Z",
      }),
      "2026-08-30T00:00:00.000Z"
    );
    assert.equal(
      resolveOperationalRosterActionablePaymentDueAt({
        financialDisplayState: "PARTIALLY_PAID",
        paymentDueAt: "2026-08-30T00:00:00.000Z",
      }),
      "2026-08-30T00:00:00.000Z"
    );
    assert.equal(
      resolveOperationalRosterActionablePaymentDueAt({
        financialDisplayState: "PAID",
        paymentDueAt: "2026-08-30T00:00:00.000Z",
      }),
      null
    );
    assert.equal(
      resolveOperationalRosterActionablePaymentDueAt({
        financialDisplayState: "WAIVED",
        paymentDueAt: "2026-08-30T00:00:00.000Z",
      }),
      null
    );
  });

  it("maps approved unpaid participants to the payment action note", () => {
    assert.equal(
      resolveOperationalRosterNoteKind({
        isFinalParticipant: false,
        financialDisplayState: "UNPAID",
        paymentDueAt: null,
        refundDisplayState: "none",
        isDriverOffer: false,
      }),
      "payment_required"
    );
    assert.equal(
      resolveOperationalRosterNoteKind({
        isFinalParticipant: true,
        financialDisplayState: "PAID",
        paymentDueAt: null,
        refundDisplayState: "none",
        isDriverOffer: false,
      }),
      "ready"
    );
  });

  it("reduces the four operational cases to one primary stage", () => {
    assert.equal(
      resolveOperationalRosterStage({
        isFinalParticipant: false,
        financialDisplayState: "UNPAID",
      }),
      "approved_payment_required"
    );
    assert.equal(
      resolveOperationalRosterStage({
        isFinalParticipant: true,
        financialDisplayState: "UNPAID",
      }),
      "final_payment_required"
    );
    assert.equal(
      resolveOperationalRosterStage({
        isFinalParticipant: false,
        financialDisplayState: "PAID",
      }),
      "approved_ready_to_finalize"
    );
    assert.equal(
      resolveOperationalRosterStage({
        isFinalParticipant: true,
        financialDisplayState: "WAIVED",
      }),
      "final_ready"
    );
  });

  it("roster href encodes tour id and filter", () => {
    const href = buildTourOperationalRosterHref("tour-abc", "unpaid");
    assert.match(href, /operational-roster/);
    assert.match(href, /filter=unpaid/);
    assert.match(href, /tour-abc/);
  });
});
