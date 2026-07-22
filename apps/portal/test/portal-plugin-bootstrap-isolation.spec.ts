/**
 * P3.3 — Portal must boot the active workspace plugin without requiring all products.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  clearWorkspaceIntakePluginRegistryForTests,
  listWorkspaceIntakePluginIds,
} from "@app-tour/workspace-sdk";
import {
  registerWorkspacePluginSafe,
  resetWorkspacePluginBootstrapStateForTests,
  setWorkspacePluginRegisterInvokers,
} from "@app-tour/workspace-plugin-host/register-safe";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relPath: string): string {
  return readFileSync(join(repoRoot, relPath), "utf8");
}

afterEach(() => {
  resetWorkspacePluginBootstrapStateForTests();
  clearWorkspaceIntakePluginRegistryForTests();
});

describe("portal-plugin-bootstrap-isolation.spec.ts — P3.3", () => {
  it("P3.3-AUDIT-01 layout registers only bootstrap.pluginId (no registerAll)", () => {
    const layout = read("apps/portal/app/layout.tsx");
    assert.match(layout, /registerWorkspacePluginSafe\(\s*bootstrap\.pluginId\s*\)/);
    assert.doesNotMatch(layout, /registerAllWorkspacePluginsSafe/);
    assert.match(layout, /bindWorkspacePluginRegisterInvokers/);
  });

  it("P3.3-AUDIT-02 register page uses active-plugin safe path", () => {
    const page = read("apps/portal/app/catalog/[tourId]/register/page.tsx");
    assert.match(page, /registerWorkspacePluginSafe\(\s*bootstrap\.pluginId\s*\)/);
    assert.doesNotMatch(page, /registerAllWorkspacePluginsSafe/);
  });

  it("P3.3-AUDIT-03 instrumentation binds registrars; warm-all is opt-in (P4.4)", () => {
    const instrumentation = read("apps/portal/instrumentation.ts");
    assert.match(instrumentation, /bindWorkspacePluginRegisterInvokers/);
    assert.match(instrumentation, /PORTAL_WARM_ALL_PLUGINS/);
    assert.match(instrumentation, /registerAllWorkspacePluginsSafe/);
    assert.match(instrumentation, /shouldWarmAllWorkspacePlugins/);
    assert.match(instrumentation, /try\s*\{/);
    assert.match(instrumentation, /catch\s*\(/);
  });

  it("P3.3-RT-01 registerWorkspacePluginSafe invokes only the requested plugin id", async () => {
    const called: string[] = [];
    resetWorkspacePluginBootstrapStateForTests();
    setWorkspacePluginRegisterInvokers({
      full: async (pluginId) => {
        called.push(pluginId);
      },
      intake: async (pluginId) => {
        called.push(`intake:${pluginId}`);
      },
    });

    const result = await registerWorkspacePluginSafe("urban");
    assert.equal(result.status, "ready");
    assert.deepEqual(called, ["urban"]);
    assert.deepEqual(listWorkspaceIntakePluginIds(), []);
  });

  it("P3.3-RT-02 failed sibling does not block active plugin registration", async () => {
    resetWorkspacePluginBootstrapStateForTests();
    setWorkspacePluginRegisterInvokers({
      full: async (pluginId) => {
        if (pluginId === "denali") {
          throw new Error("WORKSPACE_PLUGIN_LOAD_FAILED:denali:P3.3");
        }
      },
    });

    const denali = await registerWorkspacePluginSafe("denali");
    const urban = await registerWorkspacePluginSafe("urban");
    assert.equal(denali.status, "failed");
    assert.equal(urban.status, "ready");
  });
});
