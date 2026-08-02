/**
 * Thin Shell Phase 4bd — financeNav capability + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";
import { getWorkspacePlugin as getFinanceWs5Plugin } from "@app-tour/workspace-finance-ws5";
import { resolveFinanceNavCapability } from "@app-tour/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-finance-nav-capability — Phase 4bd", () => {
  it("TS-4BD-01 denali + finance-ws5 publish capabilities.financeNav", () => {
    assert.equal(resolveFinanceNavCapability(getDenaliPlugin())?.supported, true);
    assert.equal(resolveFinanceNavCapability(getFinanceWs5Plugin())?.supported, true);
  });

  it("TS-4BD-02 finance-nav binder deleted; registry is capability-only", () => {
    assert.equal(
      existsSync(resolve(WEB_ROOT, "src/bootstrap/workspace-finance-nav-bindings.generated.ts")),
      false
    );
    const registry = readFileSync(resolve(WEB_ROOT, "src/finance/finance-nav-registry.ts"), "utf8");
    const enablement = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-nav-enablement.ts"),
      "utf8"
    );
    const layout = readFileSync(resolve(WEB_ROOT, "app/(app)/layout.tsx"), "utf8");

    assert.match(registry, /resolveFinanceNavCapability/);
    assert.match(registry, /app-cloud\.financeNavCache/);
    assert.doesNotMatch(registry, /workspace-finance-nav-bindings/);
    assert.match(enablement, /finance-nav-registry/);
    assert.match(layout, /ensureFinanceNavSupported/);
  });
});
