import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FORBIDDEN_WALLET_MODULE_DISABLED,
  WALLET_MODULE_THEME_KEY,
  WALLET_WORKSPACE_UNSUPPORTED,
  isWalletModuleEnabled,
  parseEnabledModulesFromTheme,
} from "../src/wallet/index.js";

const demoBindings = {
  isSupportedWorkspace: (workspaceType: string) => workspaceType === "demo-wallet",
  isDefaultEnabledWhenModulesUnset: (workspaceType: string) => workspaceType === "demo-wallet",
};

describe("WALLET-P1 wallet module enablement", () => {
  it("parseEnabledModulesFromTheme reads enabledModules and enabled_modules", () => {
    assert.deepEqual(parseEnabledModulesFromTheme({ enabledModules: ["wallet", "tours"] }), [
      "wallet",
      "tours",
    ]);
    assert.deepEqual(parseEnabledModulesFromTheme({ enabled_modules: ["wallet"] }), ["wallet"]);
    assert.deepEqual(parseEnabledModulesFromTheme(null), []);
  });

  it("enabledModules containing wallet enables module", () => {
    assert.equal(
      isWalletModuleEnabled({ enabledModules: [WALLET_MODULE_THEME_KEY] }, "demo-wallet", demoBindings),
      true,
    );
  });

  it("non-empty enabledModules without wallet disables module", () => {
    assert.equal(
      isWalletModuleEnabled({ enabledModules: ["tours"] }, "demo-wallet", demoBindings),
      false,
    );
  });

  it("empty or unset enabledModules uses defaultModuleEnabledWhenUnset binding", () => {
    assert.equal(isWalletModuleEnabled({}, "demo-wallet", demoBindings), true);
    assert.equal(isWalletModuleEnabled({}, "other", demoBindings), false);
    assert.equal(
      isWalletModuleEnabled({}, "demo-wallet", {
        isSupportedWorkspace: () => true,
        isDefaultEnabledWhenModulesUnset: () => false,
      }),
      false,
    );
  });

  it("unsupported workspace fails closed (never enabled)", () => {
    assert.equal(
      isWalletModuleEnabled({ enabledModules: [WALLET_MODULE_THEME_KEY] }, "urban", demoBindings),
      false,
    );
  });

  it("exports stable wallet error codes", () => {
    assert.equal(WALLET_WORKSPACE_UNSUPPORTED, "WALLET_WORKSPACE_UNSUPPORTED");
    assert.equal(FORBIDDEN_WALLET_MODULE_DISABLED, "FORBIDDEN_WALLET_MODULE_DISABLED");
  });
});
