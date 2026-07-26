/**
 * Phase 1.2 / Thin Shell Phase 4bd — finance nav enablement from capabilities.financeNav.
 * Fixture `finance-ws2` must not see finance nav (registry-only architecture proof).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ensureFinanceNavSupported,
  isFinanceNavPlugin,
  isFinanceRouteAllowed,
  shouldShowFinanceNav,
} from "../src/finance/finance-nav-enablement";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DENALI_PLUGIN_ID = "denali";
const WS2_PLUGIN_ID = "finance-ws2";
const URBAN_PLUGIN_ID = "urban";

describe("finance-nav-enablement.spec.ts — Phase 1.2 / 4bd", () => {
  it("WEB-P1.2-01 Denali sees finance after ensure", async () => {
    assert.equal(await ensureFinanceNavSupported(DENALI_PLUGIN_ID), true);
    assert.equal(shouldShowFinanceNav(DENALI_PLUGIN_ID), true);
    assert.equal(isFinanceRouteAllowed(DENALI_PLUGIN_ID), true);
    assert.equal(isFinanceNavPlugin(DENALI_PLUGIN_ID), true);
  });

  it("WEB-P1.2-02 finance-ws2 fixture does not see finance nav/gate", async () => {
    assert.equal(await ensureFinanceNavSupported(WS2_PLUGIN_ID), false);
    assert.equal(isFinanceNavPlugin(WS2_PLUGIN_ID), false);
    assert.equal(shouldShowFinanceNav(WS2_PLUGIN_ID), false);
    assert.equal(isFinanceRouteAllowed(WS2_PLUGIN_ID), false);
  });

  it("WEB-P1.2-03 unsupported workspace does not see finance", async () => {
    assert.equal(await ensureFinanceNavSupported(URBAN_PLUGIN_ID), false);
    assert.equal(shouldShowFinanceNav(URBAN_PLUGIN_ID), false);
    assert.equal(isFinanceRouteAllowed(URBAN_PLUGIN_ID), false);
    assert.equal(await ensureFinanceNavSupported("starter"), false);
    assert.equal(shouldShowFinanceNav("starter"), false);
    assert.equal(await ensureFinanceNavSupported("not-a-workspace"), false);
    assert.equal(shouldShowFinanceNav("not-a-workspace"), false);
  });

  it("WEB-P1.2-04 enablement uses capability registry (not wizard extendedChrome)", () => {
    const nav = readFileSync(resolve(WEB_ROOT, "src/finance/finance-nav-enablement.ts"), "utf8");
    const registry = readFileSync(resolve(WEB_ROOT, "src/finance/finance-nav-registry.ts"), "utf8");
    const codegen = readFileSync(
      resolve(WEB_ROOT, "../../scripts/codegen/workspace-registry/domains/finance.mjs"),
      "utf8"
    );
    assert.equal(
      existsSync(resolve(WEB_ROOT, "src/bootstrap/workspace-finance-nav-bindings.generated.ts")),
      false
    );
    assert.match(nav, /finance-nav-registry/);
    assert.doesNotMatch(nav, /workspace-finance-nav-bindings/);
    assert.doesNotMatch(nav, /isExtendedOperatorWorkspace/);
    assert.doesNotMatch(nav, /wizard-create-bindings/);
    assert.match(registry, /resolveFinanceNavCapability/);
    assert.match(registry, /export function isFinanceNavPlugin/);
    assert.match(registry, /app-cloud\.financeNavCache/);
    assert.doesNotMatch(codegen, /FINANCE_NAV_ARCHITECTURE_PROOF/);
    assert.doesNotMatch(codegen, /FINANCE_NAV_ARCHITECTURE_PROOF_PLUGIN_IDS/);
    assert.doesNotMatch(codegen, /Object\.freeze\(\[\"finance-ws2\"\]\)/);
  });
});
