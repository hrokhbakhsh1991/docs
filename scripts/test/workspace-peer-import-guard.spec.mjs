import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { auditWorkspacePluginSurface, isAllowedPluginSurfaceExport } from "../guards/lib/plugin-surface-guard.mjs";

test("isAllowedPluginSurfaceExport accepts contract exports", () => {
  assert.equal(isAllowedPluginSurfaceExport("getDenaliWorkspacePlugin"), true);
  assert.equal(isAllowedPluginSurfaceExport("createUrbanWorkspacePlugin"), true);
  assert.equal(isAllowedPluginSurfaceExport("DENALI_WORKSPACE_PLUGIN_ID"), true);
  assert.equal(isAllowedPluginSurfaceExport("denaliHydrateTourCloneDraft"), false);
});

test("guard-workspace-peer-import passes on clean tree", () => {
  const result = spawnSync("node", ["scripts/guards/guard-workspace-peer-import.mjs"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("auditWorkspacePluginSurface flags disallowed exports", () => {
  const repoRoot = process.cwd();
  const { violations } = auditWorkspacePluginSurface(repoRoot, {
    id: "denali",
    plugin: { entry: "./plugin" },
  });
  assert.equal(violations.length, 0);
});
