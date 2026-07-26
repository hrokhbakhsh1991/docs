/**
 * Thin Shell Phase 4be — financeOps capability + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-cloud/workspace-denali";
import { getWorkspacePlugin as getFinanceWs5Plugin } from "@app-cloud/workspace-finance-ws5";
import { resolveFinanceOpsCapability } from "@app-cloud/workspace-sdk";

import { resolveFinanceOpsCapabilityForHub } from "../src/finance/finance-ops-panels";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-finance-ops-capability — Phase 4be", () => {
  it("TS-4BE-01 denali + finance-ws5 publish capabilities.financeOps.resolveManifest", () => {
    const denali = resolveFinanceOpsCapability(getDenaliPlugin());
    const ws5 = resolveFinanceOpsCapability(getFinanceWs5Plugin());
    assert.ok(denali);
    assert.ok(ws5);
    assert.equal(typeof denali.resolveManifest, "function");
    assert.equal(typeof ws5.resolveManifest, "function");
    const payload = denali.resolveManifest(null) as { version?: string };
    assert.equal(payload.version, "1");
  });

  it("TS-4BE-02 finance-ops binder deleted; hub resolves via capability", async () => {
    assert.equal(
      existsSync(resolve(WEB_ROOT, "src/bootstrap/workspace-finance-ops-bindings.generated.ts")),
      false
    );
    const panels = readFileSync(resolve(WEB_ROOT, "src/finance/finance-ops-panels.ts"), "utf8");
    assert.match(panels, /resolveFinanceOpsCapability/);
    assert.match(panels, /loadBootstrapWorkspacePlugin/);
    assert.doesNotMatch(panels, /workspace-finance-ops-bindings/);
    assert.doesNotMatch(panels, /@app-cloud\/workspace-denali/);

    const hub = await resolveFinanceOpsCapabilityForHub(null, "denali");
    assert.ok(hub);
    assert.equal(hub.version, "1");
    assert.equal(await resolveFinanceOpsCapabilityForHub(null, "urban"), null);
  });
});
