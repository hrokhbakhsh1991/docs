import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { WorkspacePluginClientBundleDisabledError } from "../src/bootstrap/workspace-plugin-client-bundle-gate";
import {
  OperatorWizardWarmError,
  warmOperatorWizardShell,
} from "../src/wizard/warm-operator-wizard-shell";

function fakePlugin(id = "denali"): WorkspacePlugin {
  return { id, wizard: { roots: [], steps: {} } } as WorkspacePlugin;
}

async function expectWarmCode(
  action: Promise<WorkspacePlugin>,
  code: OperatorWizardWarmError["code"]
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof OperatorWizardWarmError);
    assert.equal(error.code, code);
    assert.equal(error.pluginId, "denali");
    return true;
  });
}

describe("operator wizard warm boundary", () => {
  it("returns the plugin after host readiness succeeds", async () => {
    const plugin = fakePlugin();
    let readyCalls = 0;
    const result = await warmOperatorWizardShell("denali", {
      loadPlugin: async () => plugin,
      ensureHostReady: async () => {
        readyCalls += 1;
      },
      hostReadyTimeoutMs: 50,
    });
    assert.equal(result, plugin);
    assert.equal(readyCalls, 1);
  });

  it("preserves disabled-bundle context without attempting host readiness", async () => {
    let readyCalls = 0;
    await expectWarmCode(
      warmOperatorWizardShell("denali", {
        loadPlugin: async () => {
          throw new WorkspacePluginClientBundleDisabledError("denali", "ALLOW_DENALI_WEB_PLUGIN");
        },
        ensureHostReady: async () => {
          readyCalls += 1;
        },
      }),
      "WORKSPACE_PLUGIN_CLIENT_BUNDLE_DISABLED"
    );
    assert.equal(readyCalls, 0);
  });

  it("reports import failures as a terminal typed error", async () => {
    await expectWarmCode(
      warmOperatorWizardShell("denali", {
        loadPlugin: async () => {
          throw new Error("chunk unavailable");
        },
      }),
      "WORKSPACE_PLUGIN_LOAD_FAILED"
    );
  });

  it("times out a host that never becomes ready", async () => {
    await expectWarmCode(
      warmOperatorWizardShell("denali", {
        loadPlugin: async () => fakePlugin(),
        ensureHostReady: () => new Promise<void>(() => undefined),
        hostReadyTimeoutMs: 5,
      }),
      "WORKSPACE_WIZARD_HOST_READY_TIMEOUT"
    );
  });

  it("reports a rejected host readiness hook", async () => {
    await expectWarmCode(
      warmOperatorWizardShell("denali", {
        loadPlugin: async () => fakePlugin(),
        ensureHostReady: async () => {
          throw new Error("surface registration failed");
        },
      }),
      "WORKSPACE_WIZARD_HOST_READY_FAILED"
    );
  });
});
