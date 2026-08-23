import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  clearWorkspaceRegistrationFlowRegistryForTests,
  getWorkspaceRegistrationFlowPlugin,
  listWorkspaceRegistrationFlowPluginIds,
} from "@app-tour/workspace-sdk";
import { getWorkspaceRegistrationFlowSteps } from "@app-tour/workspace-plugin-host/registration-flow";
import { resetWorkspacePluginBootstrapStateForTests } from "@app-tour/workspace-plugin-host/register-safe";

import {
  ensureWorkspaceRegistrationFlowClient,
  resetWorkspaceRegistrationFlowClientForTests,
} from "../src/ensure-registration-flow.client.ts";
import { WORKSPACE_PLUGIN_REGISTER_IDS } from "../src/workspace-plugin-register-manifest.generated.ts";

/** CW2-04 parity — manifest workspaces with catalogRegistrationFlow. */
const REGISTRATION_FLOW_WORKSPACES = ["denali", "guest-club", "harbor", "urban"] as const;

function resetRegistrationClientState(): void {
  resetWorkspacePluginBootstrapStateForTests();
  resetWorkspaceRegistrationFlowClientForTests();
  clearWorkspaceRegistrationFlowRegistryForTests();
}

const source = readFileSync(
  fileURLToPath(new URL("../src/ensure-registration-flow.client.ts", import.meta.url)),
  "utf8"
);

describe("client registration dispatch", () => {
  afterEach(() => {
    resetRegistrationClientState();
  });

  it("uses generated dispatch without product branches or imports", () => {
    assert.doesNotMatch(source, /denali|urban|harbor|guest-club|starter/);
    assert.doesNotMatch(source, /switch\s*\(/);
    assert.doesNotMatch(source, /@app-tour\/workspace-(denali|urban|harbor|guest-club|starter)/);
  });

  it("CW2-04 generated manifest includes all registration-flow workspaces", () => {
    for (const workspaceId of REGISTRATION_FLOW_WORKSPACES) {
      assert.ok(
        WORKSPACE_PLUGIN_REGISTER_IDS.includes(workspaceId),
        `expected ${workspaceId} in WORKSPACE_PLUGIN_REGISTER_IDS`
      );
    }
  });

  for (const workspaceId of REGISTRATION_FLOW_WORKSPACES) {
    it(`CW2-04 parity: ${workspaceId} lazy-registers flow plugin + steps (idempotent)`, async () => {
      resetRegistrationClientState();

      const first = ensureWorkspaceRegistrationFlowClient(workspaceId);
      const second = ensureWorkspaceRegistrationFlowClient(workspaceId);
      assert.strictEqual(first, second);
      assert.equal((await first).status, "ready");
      assert.deepEqual([...listWorkspaceRegistrationFlowPluginIds()], [workspaceId]);
      assert.equal(getWorkspaceRegistrationFlowPlugin(workspaceId)?.id, workspaceId);
      assert.notEqual(getWorkspaceRegistrationFlowSteps(workspaceId), null);
    });
  }

  it("fails closed for an unknown workspace", async () => {
    resetRegistrationClientState();

    const result = await ensureWorkspaceRegistrationFlowClient("future-workspace");
    assert.equal(result.status, "failed");
    assert.match(
      result.status === "failed" ? result.error : "",
      /WORKSPACE_PLUGIN_REGISTER_UNKNOWN/
    );
  });
});
