/**
 * PR23 UX-1 — outstanding AR UI parse + safety guards.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  financeOutstandingLogicForbidsClientAgingMath,
  filterOutstandingByTourId,
  parseOutstandingBalancesResponse,
  parseTourCollectionsResponse,
} from "../src/finance/finance-outstanding-logic.ts";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-outstanding-ux1", () => {
  it("parses outstanding balances page from server shape", () => {
    const page = parseOutstandingBalancesResponse({
      items: [
        {
          registrationId: "reg-1",
          identity: {
            memberDisplayName: "Ada",
            tourTitle: "Peak",
            tourId: "tour-1",
          },
          invoice: {
            totalMinor: "100000000",
            paidMinor: "40000000",
            remainingMinor: "60000000",
            currency: "IRR",
          },
          bookingPaymentStatus: "partial",
          occurredAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]?.invoice.remainingMinor, "60000000");
  });

  it("parses tour collections remaining from server", () => {
    const page = parseTourCollectionsResponse({
      items: [
        {
          tourId: "tour-1",
          tourTitle: "Peak",
          registrationsCount: 2,
          invoiceTotalMinor: "200000000",
          collectedMinor: "80000000",
          remainingMinor: "120000000",
          currency: "IRR",
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    assert.equal(page.items[0]?.remainingMinor, "120000000");
  });

  it("filters by tour without recomputing money", () => {
    const page = parseOutstandingBalancesResponse({
      items: [
        {
          registrationId: "a",
          identity: { memberDisplayName: null, tourTitle: null, tourId: "t1" },
          invoice: {
            totalMinor: "1",
            paidMinor: "0",
            remainingMinor: "1",
            currency: "IRR",
          },
          bookingPaymentStatus: null,
          occurredAt: "2026-08-01T00:00:00.000Z",
        },
        {
          registrationId: "b",
          identity: { memberDisplayName: null, tourTitle: null, tourId: "t2" },
          invoice: {
            totalMinor: "1",
            paidMinor: "0",
            remainingMinor: "1",
            currency: "IRR",
          },
          bookingPaymentStatus: null,
          occurredAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    assert.equal(filterOutstandingByTourId(page.items, "t1").length, 1);
  });

  it("forbids client aging / money arithmetic in logic module", () => {
    const logic = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-outstanding-logic.ts"),
      "utf8"
    );
    assert.equal(financeOutstandingLogicForbidsClientAgingMath(logic), true);
  });

  it("panel consumes D1/D2 BFF only — no aging endpoint invention", () => {
    const panel = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-outstanding-panel.tsx"),
      "utf8"
    );
    assert.match(panel, /outstanding-balances/);
    assert.match(panel, /tour-collections/);
    assert.doesNotMatch(panel, /\/finance\/reports\/outstanding-aging/);
    assert.doesNotMatch(panel, /psp|stripe|gateway|chargeback/i);
  });

  it("overview separates owed from collected and surfaces refunds awaiting", () => {
    const overview = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-overview-panel.tsx"),
      "utf8"
    );
    assert.match(overview, /needsActionSection/);
    assert.match(overview, /moneyOwedSection/);
    assert.match(overview, /collectedByTour/);
    assert.match(overview, /refunds\?status=Requested/);
    assert.match(overview, /outstanding-balances/);
    assert.doesNotMatch(overview, /paidByTourTitle/);
  });

  it("command center soft-hides meaning without registration and mounts outstanding", () => {
    const shell = readFileSync(
      resolve(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.match(shell, /FinanceOutstandingPanel/);
    assert.match(shell, /registrationId \? \(/);
    assert.match(shell, /activeTab === "outstanding"/);
  });
});
