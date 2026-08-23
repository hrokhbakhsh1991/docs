import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  clearWorkspaceRegistrationFlowRegistryForTests,
  listWorkspaceRegistrationFlowPluginIds,
} from "@app-tour/workspace-sdk";
import { resetWorkspacePluginBootstrapStateForTests } from "@app-tour/workspace-plugin-host/register-safe";

import {
  ensureWorkspaceRegistrationFlowClient,
  resetWorkspaceRegistrationFlowClientForTests,
} from "../src/ensure-registration-flow.client.ts";

const source = readFileSync(
  fileURLToPath(new URL("../src/ensure-registration-flow.client.ts", import.meta.url)),
  "utf8"
);

describe("client registration dispatch", () => {
  it("uses generated dispatch without product branches or imports", () => {
    assert.doesNotMatch(source, /denali|urban|harbor|guest-club|starter/);
    assert.doesNotMatch(source, /switch\s*\(/);
    assert.doesNotMatch(source, /@app-tour\/workspace-(denali|urban|harbor|guest-club|starter)/);
  });

  it("registers Denali through the generated lazy registrar and is idempotent", async () => {
    resetWorkspacePluginBootstrapStateForTests();
    resetWorkspaceRegistrationFlowClientForTests();
    clearWorkspaceRegistrationFlowRegistryForTests();

    const first = ensureWorkspaceRegistrationFlowClient("denali");
    const second = ensureWorkspaceRegistrationFlowClient("denali");
    assert.strictEqual(first, second);
    assert.equal((await first).status, "ready");
    assert.deepEqual([...listWorkspaceRegistrationFlowPluginIds()], ["denali"]);
  });

  it("fails closed for an unknown workspace", async () => {
    resetWorkspacePluginBootstrapStateForTests();
    resetWorkspaceRegistrationFlowClientForTests();
    clearWorkspaceRegistrationFlowRegistryForTests();

    const result = await ensureWorkspaceRegistrationFlowClient("future-workspace");
    assert.equal(result.status, "failed");
    assert.match(
      result.status === "failed" ? result.error : "",
      /WORKSPACE_PLUGIN_REGISTER_UNKNOWN/
    );
  });
});
