/**
 * Phase 1.2 — finance nav enablement from workspaceFinance bindings.
 * Fixture `finance-ws2` must not appear in nav (registry-only architecture proof).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isFinanceNavPlugin,
  WORKSPACE_FINANCE_NAV_PLUGIN_IDS,
} from "../src/bootstrap/workspace-finance-nav-bindings.generated";
import {
  isFinanceRouteAllowed,
  shouldShowFinanceNav,
} from "../src/finance/finance-nav-enablement";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DENALI_PLUGIN_ID = "denali";
const WS2_PLUGIN_ID = "finance-ws2";
const URBAN_PLUGIN_ID = "urban";

describe("finance-nav-enablement.spec.ts — Phase 1.2", () => {
  it("WEB-P1.2-01 Denali sees finance", () => {
    assert.equal(shouldShowFinanceNav(DENALI_PLUGIN_ID), true);
    assert.equal(isFinanceRouteAllowed(DENALI_PLUGIN_ID), true);
    assert.equal(isFinanceNavPlugin(DENALI_PLUGIN_ID), true);
  });

  it("WEB-P1.2-02 finance-ws2 fixture does not see finance nav/gate", () => {
    assert.equal(WORKSPACE_FINANCE_NAV_PLUGIN_IDS.has(WS2_PLUGIN_ID), false);
    assert.equal(shouldShowFinanceNav(WS2_PLUGIN_ID), false);
    assert.equal(isFinanceRouteAllowed(WS2_PLUGIN_ID), false);
  });

  it("WEB-P1.2-03 unsupported workspace does not see finance", () => {
    assert.equal(shouldShowFinanceNav(URBAN_PLUGIN_ID), false);
    assert.equal(isFinanceRouteAllowed(URBAN_PLUGIN_ID), false);
    assert.equal(shouldShowFinanceNav("starter"), false);
    assert.equal(shouldShowFinanceNav("not-a-workspace"), false);
  });

  it("WEB-P1.2-04 enablement uses generated bindings (not wizard extendedChrome)", () => {
    const nav = readFileSync(resolve(WEB_ROOT, "src/finance/finance-nav-enablement.ts"), "utf8");
    const bindings = readFileSync(
      resolve(WEB_ROOT, "src/bootstrap/workspace-finance-nav-bindings.generated.ts"),
      "utf8"
    );
    const codegen = readFileSync(
      resolve(WEB_ROOT, "../../scripts/codegen/workspace-registry/domains/finance.mjs"),
      "utf8"
    );
    assert.match(nav, /workspace-finance-nav-bindings/);
    assert.doesNotMatch(nav, /isExtendedOperatorWorkspace/);
    assert.doesNotMatch(nav, /wizard-create-bindings/);
    assert.match(bindings, /WORKSPACE_FINANCE_NAV_PLUGIN_IDS/);
    assert.match(bindings, /"denali"/);
    assert.doesNotMatch(bindings, /"finance-ws2"/);
    assert.doesNotMatch(bindings, /"urban"/);
    assert.doesNotMatch(codegen, /FINANCE_NAV_ARCHITECTURE_PROOF/);
    assert.doesNotMatch(codegen, /FINANCE_NAV_ARCHITECTURE_PROOF_PLUGIN_IDS/);
    assert.doesNotMatch(codegen, /Object\.freeze\(\[\"finance-ws2\"\]\)/);
  });
});
