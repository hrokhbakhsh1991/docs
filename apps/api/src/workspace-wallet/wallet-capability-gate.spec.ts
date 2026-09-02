/**
 * WALLET-P1 — wallet gate uses generated capability bindings (no hardcoded workspace ids).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isWalletModuleEnabled } from "./wallet-module-enabled.ts";
import {
  isWalletDefaultEnabledWhenModulesUnset,
  isWalletSupportedWorkspace,
} from "./workspace-wallet-bindings.generated.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("WALLET-P1 wallet capability gate", () => {
  it("generated bindings are empty until a workspace declares workspaceWallet", () => {
    assert.equal(isWalletSupportedWorkspace("denali"), false);
    assert.equal(isWalletSupportedWorkspace("urban"), false);
    assert.equal(isWalletDefaultEnabledWhenModulesUnset("denali"), false);
    assert.equal(isWalletDefaultEnabledWhenModulesUnset("urban"), false);
  });

  it("module enablement: explicit wallet / empty modules / other modules with unsupported workspace", () => {
    assert.equal(isWalletModuleEnabled({ enabledModules: ["wallet"] }, "urban"), false);
    assert.equal(isWalletModuleEnabled({}, "denali"), false);
    assert.equal(isWalletModuleEnabled({ enabledModules: ["tours"] }, "denali"), false);
  });

  it("gate sources have no hardcoded workspace arrays", () => {
    const gateSrc = readFileSync(join(here, "assert-wallet-access.ts"), "utf8");
    const moduleSrc = readFileSync(join(here, "wallet-module-enabled.ts"), "utf8");
    assert.equal(gateSrc.includes("validWalletWorkspaces"), false);
    assert.equal(gateSrc.includes('["denali"]'), false);
    assert.equal(gateSrc.includes('workspaceType === "denali"'), false);
    assert.equal(moduleSrc.includes('workspaceType === "denali"'), false);
    assert.match(gateSrc, /isWalletSupportedWorkspace/);
    assert.match(moduleSrc, /isWalletDefaultEnabledWhenModulesUnset/);
  });
});
