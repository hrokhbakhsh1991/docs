/**
 * F7–F8 — admin feature TSX appearance contracts.
 * @see docs/dev/dtcg-pipeline-spec.mdoc § F7 · § F8
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  ADMIN_FEATURE_PURGED_FILES,
  ADMIN_FEATURE_SCAN_DIRS,
  scanAdminFeatureAppearanceAll,
  scanAdminFeaturePurgedAppearance,
} from "../../../scripts/guards/lib/admin-feature-appearance-ast-scan.mjs";

const REPO_ROOT = new URL("../../..", import.meta.url).pathname;

describe("admin-feature-appearance-ast.spec.ts", () => {
  it("F7-01 scans patterns, dashboard, and onboarding TSX", () => {
    const { scanned } = scanAdminFeatureAppearanceAll(REPO_ROOT);
    assert.ok(scanned >= 10, `expected feature TSX files, got ${scanned}`);
    assert.deepEqual(ADMIN_FEATURE_SCAN_DIRS, [
      "apps/web/src/admin/patterns",
      "apps/web/src/admin/dashboard",
      "apps/web/src/admin/onboarding",
    ]);
  });

  it("F7-02 feature className uses semantic tokens only (no palette / hex)", () => {
    const { violations } = scanAdminFeatureAppearanceAll(REPO_ROOT);
    assert.deepEqual(
      violations,
      [],
      violations.length > 0 ? violations.join("\n") : undefined,
    );
  });

  it("F8-01 purged registry includes F8-1 pilot files", () => {
    assert.deepEqual(ADMIN_FEATURE_PURGED_FILES, [
      "apps/web/src/admin/patterns/booking-activity-timeline.tsx",
      "apps/web/src/admin/patterns/dashboard-kpi-cell.tsx",
    ]);
  });

  it("F8-02 purged files have zero className attributes", () => {
    const { violations } = scanAdminFeaturePurgedAppearance(REPO_ROOT);
    assert.deepEqual(violations, []);
  });

  it("F8-03 booking timeline and KPI hooks wired in admin skin", () => {
    const skin = readFileSync(
      `${REPO_ROOT}/packages/workspaces/denali/theme/admin-skin.css`,
      "utf8",
    );
    for (const hook of [
      "[data-booking-timeline-dot]",
      "[data-booking-timeline-label]",
      "[data-denali-kpi-label]",
      "[data-denali-kpi-value]",
    ]) {
      assert.match(skin, new RegExp(hook.replace(/[[\]]/g, "\\$&")));
    }
  });
});
