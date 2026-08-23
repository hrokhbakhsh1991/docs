import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  EXCLUDE_FILE_PATTERNS,
  EXCLUDE_PATH_SEGMENTS,
  EXCLUDE_REPO_PREFIXES,
  INCLUDE_ROOTS,
  RULES_VERSION,
  SCHEMA_VERSION,
  shouldScanFile,
} from "./cw-architecture-metrics.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts/metrics/cw-architecture-metrics.mjs");
const BASELINE = join(REPO_ROOT, "docs/dev/cw-metrics-baseline.json");

/** Synthetic repo-relative paths proving each inclusion/exclusion category (CW0-09). */
const INCLUSION_FIXTURE_PATHS = [
  "apps/api/src/tenant/context.ts",
  "apps/web/src/features/tours/list.ts",
  "apps/portal/src/app/page.tsx",
  "apps/marketing/src/catalog/card.tsx",
  "packages/workspace-sdk/src/plugin/registry.ts",
  "packages/platform-core/src/render-plan/steps.ts",
];

const EXCLUSION_FIXTURE_PATHS = [
  { path: "packages/workspaces/denali/src/catalog/foo.ts", category: "packages/workspaces" },
  { path: "legacy/tour-ops/foo.ts", category: "legacy" },
  { path: "apps/api/src/node_modules/pkg/index.ts", category: "node_modules" },
  { path: "packages/workspace-sdk/dist/index.ts", category: "dist" },
  { path: "apps/api/src/workspace/bindings.generated.ts", category: "generated.ts" },
  { path: "apps/api/src/bookings/booking-lifecycle.spec.ts", category: "spec.ts" },
  { path: "packages/workspace-sdk/src/plugin/registry.test.ts", category: "test.ts" },
  { path: "apps/api/src/fixtures/booking.fixture.ts", category: "fixtures" },
  { path: "apps/web/src/bootstrap/smoke-host.ts", category: "smoke" },
  { path: "apps/portal/src/me/profile.fixture.ts", category: "fixture.ts" },
];

describe("cw-architecture-metrics inclusion/exclusion fixtures (CW0-09)", () => {
  it("fixed inclusion roots are exported and cover app + package src trees", () => {
    assert.deepEqual(INCLUDE_ROOTS, [
      "apps/api/src",
      "apps/web/src",
      "apps/portal/src",
      "apps/marketing/src",
    ]);
    for (const rel of INCLUSION_FIXTURE_PATHS) {
      assert.equal(
        shouldScanFile(join(REPO_ROOT, rel)),
        true,
        `expected inclusion: ${rel}`
      );
    }
  });

  it("each exclusion category rejects neutral production scan", () => {
    for (const { path: rel, category } of EXCLUSION_FIXTURE_PATHS) {
      assert.equal(
        shouldScanFile(join(REPO_ROOT, rel)),
        false,
        `expected exclusion (${category}): ${rel}`
      );
    }
  });

  it("packages/workspaces included when includeWorkspaces=true", () => {
    const rel = "packages/workspaces/denali/src/catalog/foo.ts";
    assert.equal(shouldScanFile(join(REPO_ROOT, rel), false), false);
    assert.equal(shouldScanFile(join(REPO_ROOT, rel), true), true);
  });

  it("exports versioned exclusion metadata for audit", () => {
    assert.ok(EXCLUDE_REPO_PREFIXES.includes("packages/workspaces/"));
    assert.ok(EXCLUDE_PATH_SEGMENTS.includes("/legacy/"));
    assert.equal(EXCLUDE_FILE_PATTERNS.length, 5);
    assert.equal(SCHEMA_VERSION, 1);
    assert.equal(RULES_VERSION, 1);
  });
});

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

  it("frozen baseline file exists with matching schemaVersion", () => {
    const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
    assert.equal(baseline.schemaVersion, 1);
    assert.equal(baseline.rulesVersion, 1);
    assert.ok(baseline.metrics);
  });

  it("baseline:cw-compare passes against frozen baseline (PRE-CW5 gate)", () => {
    const compareScript = join(REPO_ROOT, "scripts/guards/cw-baseline-compare.mjs");
    const r = spawnSync(process.execPath, [compareScript], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout ?? "", /cw-baseline-compare: PASS/);
  });
});
