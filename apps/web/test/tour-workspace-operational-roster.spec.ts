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
  resolveOperationalRosterActionablePaymentDueAt,
} from "../src/features/tours/tour-workspace-transport-logic";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("DP-2 tour workspace operational roster contract", () => {
  it("transport tab loads unified operational roster endpoint", () => {
    const client = readFileSync(
      join(webRoot, "app/(app)/tours/[id]/workspace/transport/tour-workspace-transport-client.tsx"),
      "utf8"
    );
    assert.match(client, /buildTourOperationalRosterHref/);
    assert.doesNotMatch(client, /fetch\(`\/api\/bookings\?/);
  });

  it("BFF proxies tour operational roster route", () => {
    const route = readFileSync(
      join(webRoot, "app/api/tours/[id]/operational-roster/route.ts"),
      "utf8"
    );
    assert.match(route, /operational-roster/);
    assert.match(route, /resolveTourOpsApiBaseUrl/);
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
    assert.match(client, /TOUR_WORKSPACE_TRANSPORT_TEST_IDS\.filters/);
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

  it("roster href encodes tour id and filter", () => {
    const href = buildTourOperationalRosterHref("tour-abc", "unpaid");
    assert.match(href, /operational-roster/);
    assert.match(href, /filter=unpaid/);
    assert.match(href, /tour-abc/);
  });
});
