import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { cruiseLegacyViolations } from "./lib/legacy-cruise.js";
import { listLegacyImportCruiseRoots } from "./lib/package-cruise-roots.js";
import { FOUNDATION_LEGACY_SCAN_SCOPE } from "./lib/phase-0-test-env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("foundation legacy import contract (H-02 / H-12)", () => {
  const scanScope = FOUNDATION_LEGACY_SCAN_SCOPE;
  const cruiseRoots = listLegacyImportCruiseRoots(REPO_ROOT, scanScope);

  it("uses foundation scan scope (not env-dependent)", () => {
    assert.equal(scanScope, "foundation");
  });

  it("has package roots to scan", () => {
    assert.ok(cruiseRoots.length > 0, `no cruise roots for scope=${scanScope}`);
  });

  it("foundation scope scans only sdk + config (H-12)", () => {
    assert.deepEqual(
      [...cruiseRoots].sort(),
      ["packages/config", "packages/workspace-sdk"].sort(),
    );
  });

  it("depcruise no-legacy-imports passes for every package root", () => {
    const violations: string[] = [];

    for (const root of cruiseRoots) {
      const errors = cruiseLegacyViolations(REPO_ROOT, root);
      for (const err of errors) {
        violations.push(
          `${root}: ${err.rule?.name ?? "no-legacy-imports"} ${err.from ?? "?"} → ${err.to ?? "legacy"}`,
        );
      }
    }

    assert.equal(
      violations.length,
      0,
      violations.length
        ? `legacy import graph violations:\n${violations.join("\n")}`
        : undefined,
    );
  });
});
