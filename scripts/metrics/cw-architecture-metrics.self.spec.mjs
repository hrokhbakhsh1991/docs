import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts/metrics/cw-architecture-metrics.mjs");
const BASELINE = join(REPO_ROOT, "docs/dev/cw-metrics-baseline.json");

describe("cw-architecture-metrics self-test (CW0-09)", () => {
  it("emits schemaVersion 1 JSON with six metric groups", () => {
    const r = spawnSync(process.execPath, [SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.rulesVersion, 1);
    assert.ok(parsed.repositoryRef);
    assert.ok(parsed.metrics.workspaceIdBranches);
    assert.ok(parsed.metrics.directWorkspaceImports);
    assert.ok(parsed.metrics.genericHostEditsForOnboarding);
    assert.ok(parsed.metrics.manualCopiedModules);
    assert.ok(parsed.metrics.sharedTourRulesSingleOwnership);
    assert.ok(parsed.metrics.formalReusableCapabilities);
  });

  it("two consecutive runs are byte-identical", () => {
    const first = spawnSync(process.execPath, [SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    const second = spawnSync(process.execPath, [SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(first.status, 0);
    assert.equal(second.status, 0);
    assert.equal(first.stdout, second.stdout);
  });

  it("frozen baseline matches current script output", () => {
    const current = spawnSync(process.execPath, [SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(current.status, 0);
    const baseline = readFileSync(BASELINE, "utf8");
    assert.equal(current.stdout, baseline);
  });
});
