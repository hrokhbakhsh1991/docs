/**
 * Thin Shell Phase 4s — generic host-probe route + acme capability boot proof.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadWorkspaceHostProbeView,
  WorkspaceHostProbeMissingError,
} from "../src/bootstrap/load-workspace-host-probe";
import { WorkspacePluginNotFoundError } from "../src/bootstrap/workspace-plugin-context-errors";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-acme-host-probe — Phase 4s", () => {
  it("TS-4S-01 loadWorkspaceHostProbeView(acme) returns capability stub", async () => {
    const view = await loadWorkspaceHostProbeView("acme");
    assert.equal(view.pluginId, "acme");
    assert.equal(view.title, "Acme workspace");
    assert.match(view.body, /host-probe/);
  });

  it("TS-4S-02 unknown pluginId fails closed", async () => {
    await assert.rejects(
      () => loadWorkspaceHostProbeView("no-such-workspace-plugin"),
      WorkspacePluginNotFoundError
    );
  });

  it("TS-4S-03 plugin without hostProbe fails closed", async () => {
    await assert.rejects(() => loadWorkspaceHostProbeView("denali"), WorkspaceHostProbeMissingError);
  });

  it("TS-4S-04 generic route has no product id switches/defaults", () => {
    const page = readFileSync(resolve(WEB_ROOT, "app/workspace-host-probe/page.tsx"), "utf8");
    assert.match(page, /loadWorkspaceHostProbeView/);
    assert.doesNotMatch(page, /pluginId\s*===\s*["'](?:denali|acme|urban|starter)["']/);
    assert.doesNotMatch(page, /DEFAULT_.*PLUGIN|pluginId\s*\?\?\s*["']/);
    assert.doesNotMatch(page, /["']denali["']|["']urban["']|["']starter["']/);
    // "acme" must not appear as a hardcoded default in the page either
    assert.doesNotMatch(page, /["']acme["']/);
  });

  it("TS-4S-05 route exposes fail-closed testids for missing/not-found/capability", () => {
    const page = readFileSync(resolve(WEB_ROOT, "app/workspace-host-probe/page.tsx"), "utf8");
    for (const testId of [
      "workspace-host-probe",
      "workspace-host-probe-missing-id",
      "workspace-host-probe-not-found",
      "workspace-host-probe-capability-missing",
      "workspace-host-probe-plugin-id",
    ]) {
      assert.match(page, new RegExp(`data-testid="${testId}"`));
    }
    assert.match(page, /WorkspaceHostProbeMissingError/);
    assert.match(page, /WorkspacePluginNotFoundError/);
  });

  it("TS-4S-06 loader is fail-closed (requireWorkspacePluginId + no product defaults)", () => {
    const loader = readFileSync(
      resolve(WEB_ROOT, "src/bootstrap/load-workspace-host-probe.ts"),
      "utf8"
    );
    assert.match(loader, /requireWorkspacePluginId/);
    assert.match(loader, /resolveHostProbeCapability/);
    assert.match(loader, /WorkspaceHostProbeMissingError/);
    assert.doesNotMatch(loader, /["']denali["']|["']acme["']|["']starter["']|["']urban["']/);
    assert.doesNotMatch(loader, /\?\?\s*["']/);
  });
});
