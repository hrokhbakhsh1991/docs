/**
 * CW6-04 — workspace:create --profile scaffold, dry-run, registry determinism.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { discoverManifests } from "../generate-workspace-registry.mjs";
import { generateProfileExpansionAudit } from "../codegen/workspace-registry/domains/profile-expansion.mjs";
import {
  parseWorkspaceCreateArgs,
  planProfileWorkspaceScaffoldPaths,
  scaffoldWorkspace,
} from "../workspace-create.mjs";

function withTempRepo(fn) {
  const repoRoot = mkdtempSync(join(tmpdir(), "workspace-create-profile-"));
  try {
    return fn(repoRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

describe("workspace:create --profile (CW6-04)", () => {
  it("parses --profile and --dry-run flags", () => {
    const parsed = parseWorkspaceCreateArgs([
      "outdoor-club",
      "--guest",
      "--profile",
      "starter-outdoor",
      "--dry-run",
    ]);
    assert.equal(parsed.id, "outdoor-club");
    assert.equal(parsed.guest, true);
    assert.equal(parsed.profile, "starter-outdoor");
    assert.equal(parsed.dryRun, true);
  });

  it("dry-run plan includes profile expansion snapshot path", () => {
    const paths = planProfileWorkspaceScaffoldPaths("outdoor-club", "starter-outdoor", true);
    assert.ok(paths.includes("packages/workspaces/outdoor-club/profile.expanded.snapshot.json"));
    assert.ok(paths.includes("packages/workspaces/outdoor-club/workspace.manifest.json"));
  });

  it("scaffolds guest workspace with profile ref and expansion snapshot", () =>
    withTempRepo((repoRoot) => {
      const { dir } = scaffoldWorkspace({
        repoRoot,
        id: "outdoor-club",
        guest: true,
        profile: "starter-outdoor",
      });
      const manifest = JSON.parse(readFileSync(join(dir, "workspace.manifest.json"), "utf8"));
      assert.equal(manifest.profile, "starter-outdoor");
      assert.equal(manifest.guestExtensionsVersion, 1);

      const snapshotPath = join(dir, "profile.expanded.snapshot.json");
      assert.ok(existsSync(snapshotPath));
      const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
      assert.equal(snapshot.profile, undefined);
      assert.equal(snapshot.workspaceBooking?.supported, true);
      assert.equal(snapshot.workspaceFinance?.supported, true);
      assert.equal(snapshot.workspaceEquipment, undefined);
      assert.equal(snapshot.workspacePolicy, undefined);
    }));

  it("profile expansion audit codegen is deterministic", () => {
    const manifests = discoverManifests();
    const first = generateProfileExpansionAudit(manifests);
    const second = generateProfileExpansionAudit(manifests);
    assert.equal(first, second);
  });

  it("guest scaffold without profile keeps minimal memberProfile", () =>
    withTempRepo((repoRoot) => {
      const { dir } = scaffoldWorkspace({ repoRoot, id: "plain-club", guest: true });
      const manifest = JSON.parse(readFileSync(join(dir, "workspace.manifest.json"), "utf8"));
      assert.equal(manifest.profile, undefined);
      assert.deepEqual(manifest.memberProfile.editableFields, ["displayName"]);
      assert.equal(existsSync(join(dir, "profile.expanded.snapshot.json")), false);
    }));
});
