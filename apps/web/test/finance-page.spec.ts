/**
 * Phase 9.7 — finance command center web surface (REQ-P9-071 · ADV-P9-09).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-denali";
import { URBAN_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-urban";

import {
  FINANCE_COMMAND_CENTER_TABS,
  isFinanceRouteAllowed,
  parseFinanceTab,
  shouldShowFinanceNav,
} from "../src/finance/finance-nav-access";

describe("finance-page.spec.ts — Phase 9.7", () => {
  it("WEB-9.7-01 finance nav hidden on urban tenant", () => {
    assert.equal(shouldShowFinanceNav(URBAN_WORKSPACE_PLUGIN_ID), false);
    assert.equal(isFinanceRouteAllowed(URBAN_WORKSPACE_PLUGIN_ID), false);
  });

  it("WEB-9.7-02 finance nav visible on denali tenant", () => {
    assert.equal(shouldShowFinanceNav(DENALI_WORKSPACE_PLUGIN_ID), true);
    assert.equal(isFinanceRouteAllowed(DENALI_WORKSPACE_PLUGIN_ID), true);
  });

  it("WEB-9.7-03 command center exposes R1 + R2 tabs", () => {
    assert.deepEqual(FINANCE_COMMAND_CENTER_TABS, [
      "overview",
      "payments",
      "receipts",
      "prepayments",
      "installments",
      "ledger",
    ]);
    assert.equal(parseFinanceTab(undefined), "overview");
    assert.equal(parseFinanceTab("receipts"), "receipts");
    assert.equal(parseFinanceTab("prepayments"), "prepayments");
    assert.equal(parseFinanceTab("installments"), "installments");
    assert.equal(parseFinanceTab("unknown"), "overview");
  });
});
