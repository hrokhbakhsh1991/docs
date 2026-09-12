/**
 * WALLET-P3B — wallet nav enablement from capabilities.walletNav + module enablement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ensureWalletNavSupported,
  isWalletNavPlugin,
  isWalletRouteAllowed,
  shouldShowWalletNav,
} from "../src/wallet/wallet-nav-enablement";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WALLET_WS1_PLUGIN_ID = "wallet-ws1";
const DENALI_PLUGIN_ID = "denali";
const URBAN_PLUGIN_ID = "urban";

describe("wallet-nav-enablement.spec.ts — WALLET-P3B", () => {
  it("WEB-WALLET-P3B-01 wallet-ws1 sees wallet after ensure with default theme", async () => {
    assert.equal(await ensureWalletNavSupported(WALLET_WS1_PLUGIN_ID, {}), true);
    assert.equal(shouldShowWalletNav(WALLET_WS1_PLUGIN_ID), true);
    assert.equal(isWalletRouteAllowed(WALLET_WS1_PLUGIN_ID), true);
    assert.equal(isWalletNavPlugin(WALLET_WS1_PLUGIN_ID), true);
  });

  it("WEB-WALLET-P3B-02 Denali does not see wallet nav/gate", async () => {
    assert.equal(await ensureWalletNavSupported(DENALI_PLUGIN_ID, {}), false);
    assert.equal(isWalletNavPlugin(DENALI_PLUGIN_ID), false);
    assert.equal(shouldShowWalletNav(DENALI_PLUGIN_ID), false);
    assert.equal(isWalletRouteAllowed(DENALI_PLUGIN_ID), false);
  });

  it("WEB-WALLET-P3B-03 unsupported workspace does not see wallet", async () => {
    assert.equal(await ensureWalletNavSupported(URBAN_PLUGIN_ID, {}), false);
    assert.equal(shouldShowWalletNav(URBAN_PLUGIN_ID), false);
    assert.equal(isWalletRouteAllowed(URBAN_PLUGIN_ID), false);
    assert.equal(await ensureWalletNavSupported("starter"), false);
    assert.equal(shouldShowWalletNav("starter"), false);
    assert.equal(await ensureWalletNavSupported("not-a-workspace"), false);
    assert.equal(shouldShowWalletNav("not-a-workspace"), false);
  });

  it("WEB-WALLET-P3B-04 wallet hidden when module explicitly disabled", async () => {
    assert.equal(
      await ensureWalletNavSupported(WALLET_WS1_PLUGIN_ID, { enabledModules: ["tours"] }),
      false,
    );
    assert.equal(shouldShowWalletNav(WALLET_WS1_PLUGIN_ID), false);
  });

  it("WEB-WALLET-P3B-05 enablement uses capability registry (not wizard extendedChrome)", () => {
    const nav = readFileSync(resolve(WEB_ROOT, "src/wallet/wallet-nav-enablement.ts"), "utf8");
    const registry = readFileSync(resolve(WEB_ROOT, "src/wallet/wallet-nav-registry.ts"), "utf8");
    assert.equal(
      existsSync(resolve(WEB_ROOT, "src/bootstrap/workspace-wallet-nav-bindings.generated.ts")),
      false,
    );
    assert.match(nav, /wallet-nav-registry/);
    assert.doesNotMatch(nav, /workspace-wallet-nav-bindings/);
    assert.match(registry, /resolveWalletNavCapability/);
    assert.match(registry, /app-cloud\.walletNavCache/);
  });
});
