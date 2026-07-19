/**
 * Phase 1.17 — finance gate uses generated capability bindings (no hardcoded workspace ids).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isFinanceModuleEnabled } from "./finance-module-enabled.ts";
import {
  isFinanceDefaultEnabledWhenModulesUnset,
  isFinanceSupportedWorkspace,
} from "./workspace-finance-bindings.generated.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("FIN-P1.17 finance capability gate", () => {
  it("generated bindings support denali + finance-ws5 only; reject demoted / urban", () => {
    assert.equal(isFinanceSupportedWorkspace("denali"), true);
    assert.equal(isFinanceSupportedWorkspace("finance-ws5"), true);
    assert.equal(isFinanceSupportedWorkspace("finance-ws3"), false);
    assert.equal(isFinanceSupportedWorkspace("finance-ws4"), false);
    assert.equal(isFinanceSupportedWorkspace("finance-ws6"), false);
    assert.equal(isFinanceSupportedWorkspace("finance-ws2"), false);
    assert.equal(isFinanceSupportedWorkspace("urban"), false);
    assert.equal(isFinanceDefaultEnabledWhenModulesUnset("denali"), true);
    assert.equal(isFinanceDefaultEnabledWhenModulesUnset("finance-ws5"), true);
    assert.equal(isFinanceDefaultEnabledWhenModulesUnset("finance-ws3"), false);
    assert.equal(isFinanceDefaultEnabledWhenModulesUnset("urban"), false);
  });

  it("module enablement: explicit finance / empty modules / other modules", () => {
    assert.equal(isFinanceModuleEnabled({ enabledModules: ["finance"] }, "urban"), true);
    assert.equal(isFinanceModuleEnabled({}, "denali"), true);
    assert.equal(isFinanceModuleEnabled({}, "urban"), false);
    assert.equal(isFinanceModuleEnabled({ enabledModules: ["tours"] }, "denali"), false);
  });

  it("gate sources have no hardcoded denali workspace arrays", () => {
    const gateSrc = readFileSync(join(here, "assert-finance-access.ts"), "utf8");
    const moduleSrc = readFileSync(join(here, "finance-module-enabled.ts"), "utf8");
    assert.equal(gateSrc.includes("validFinanceWorkspaces"), false);
    assert.equal(gateSrc.includes('["denali"]'), false);
    assert.equal(gateSrc.includes('workspaceType === "denali"'), false);
    assert.equal(moduleSrc.includes('workspaceType === "denali"'), false);
    assert.match(gateSrc, /isFinanceSupportedWorkspace/);
    assert.match(moduleSrc, /isFinanceDefaultEnabledWhenModulesUnset/);
  });
});
