/**
 * FC-3 — finance hub tour filter wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  withFinanceListScopeQuery,
  withFinanceTourQuery,
} from "../src/finance/finance-registration-context";
import { FINANCE_TOUR_FILTER_TEST_IDS } from "../src/finance/finance-tour-filter";
import { parseFinanceByTourReport } from "../src/finance/finance-reports-logic";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-tour-filter.spec.ts — FC-3", () => {
  it("WEB-FC3-01 withFinanceTourQuery appends tourId", () => {
    assert.equal(
      withFinanceTourQuery("/api/finance/payments?limit=5", "00000000-0000-4000-8000-000000000099"),
      "/api/finance/payments?limit=5&tourId=00000000-0000-4000-8000-000000000099"
    );
    assert.equal(withFinanceTourQuery("/finance?tab=payments", ""), "/finance?tab=payments");
  });

  it("WEB-FC3-02 withFinanceListScopeQuery chains registration + tour", () => {
    assert.equal(
      withFinanceListScopeQuery("/api/finance/payments", {
        registrationId: "00000000-0000-4000-8000-000000000011",
        tourId: "00000000-0000-4000-8000-000000000022",
      }),
      "/api/finance/payments?registrationId=00000000-0000-4000-8000-000000000011&tourId=00000000-0000-4000-8000-000000000022"
    );
  });

  it("WEB-FC3-03 parseFinanceByTourReport validates aggregate rows", () => {
    const parsed = parseFinanceByTourReport({
      items: [
        {
          tourId: "tour-1",
          tourTitle: "North Ridge",
          currency: "CAD",
          paidCount: 2,
          paidMinor: "5000000",
          pendingCount: 1,
        },
      ],
    });
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0]?.tourTitle, "North Ridge");
    assert.equal(parsed.items[0]?.currency, "CAD");
    assert.equal(parsed.items[0]?.paidMinor, "5000000");
  });

  it("WEB-FC3-04 command center wires FinanceTourFilter + list scope in panels", () => {
    const hub = readFileSync(
      resolve(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    const payments = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-payments-panel.tsx"),
      "utf8"
    );
    const ledger = readFileSync(resolve(WEB_ROOT, "src/finance/finance-ledger-panel.tsx"), "utf8");
    const overview = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-overview-panel.tsx"),
      "utf8"
    );
    const filter = readFileSync(resolve(WEB_ROOT, "src/finance/finance-tour-filter.tsx"), "utf8");
    assert.match(hub, /FinanceTourFilter/);
    assert.match(hub, /finance-tour-filter-banner/);
    assert.match(payments, /withFinanceListScopeQuery/);
    assert.match(payments, /tourFilter/);
    assert.match(ledger, /withFinanceListScopeQuery/);
    assert.match(overview, /formatMinorAmount\(row\.paidMinor, row\.currency, locale\)/);
    assert.doesNotMatch(overview, /formatMinorAmount\(row\.paidMinor, "IRR", locale\)/);
    assert.match(filter, new RegExp(FINANCE_TOUR_FILTER_TEST_IDS.root));
    assert.match(filter, /OperatorSearchableSelect/);
    assert.match(filter, /tourFilterSearchPlaceholder/);
  });
});
