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
      "apps/web/src/admin/patterns/denali-skeleton.tsx",
      "apps/web/src/admin/patterns/denali-empty-state.tsx",
      "apps/web/src/admin/patterns/page-header.tsx",
      "apps/web/src/admin/patterns/settings-page-header.tsx",
      "apps/web/src/admin/patterns/dashboard-widget-card.tsx",
      "apps/web/src/admin/dashboard/dashboard-bookings-widget.tsx",
      "apps/web/src/admin/dashboard/dashboard-overview-widget.tsx",
      "apps/web/src/admin/dashboard/dashboard-tours-widget.tsx",
      "apps/web/src/admin/dashboard/dashboard-registrations-widget.tsx",
      "apps/web/src/admin/patterns/denali-confirm-dialog.tsx",
      "apps/web/src/admin/onboarding/operator-welcome-dialog.tsx",
      "apps/web/src/admin/patterns/tour-category-badge.tsx",
      "apps/web/src/admin/patterns/operator-profile-avatar.tsx",
      "apps/web/src/admin/onboarding/operator-welcome-gate.tsx",
      "apps/web/src/admin/dashboard/dashboard-widget-registry.tsx",
    ]);
  });

  it("F8-02 purged files have zero className attributes", () => {
    const { violations } = scanAdminFeaturePurgedAppearance(REPO_ROOT);
    assert.deepEqual(violations, []);
  });

  it("F8-03 booking timeline, KPI, skeleton, and empty-state hooks in theme CSS", () => {
    const skin = readFileSync(
      `${REPO_ROOT}/packages/workspaces/denali/theme/admin-skin.css`,
      "utf8",
    );
    const animations = readFileSync(
      `${REPO_ROOT}/packages/workspaces/denali/theme/animations.css`,
      "utf8",
    );
    for (const hook of [
      "[data-booking-timeline-dot]",
      "[data-denali-kpi-label]",
      "[data-denali-empty-state-action]",
      "[data-denali-page-header-title]",
      "[data-denali-settings-back-link]",
      "[data-denali-dashboard-widget]",
      "[data-denali-dashboard-kpi-grid]",
      "[data-denali-dashboard-widget-error]",
      "[data-denali-dashboard-tour-row]",
      "[data-denali-dashboard-registration-row]",
      "[data-denali-confirm-dialog]",
      "[data-denali-welcome-dialog]",
      "[data-denali-welcome-bullets]",
      "[data-denali-profile-avatar]",
    ]) {
      assert.match(skin, new RegExp(hook.replace(/[[\]]/g, "\\$&")));
    }
    assert.match(animations, /\[data-denali-skeleton-size="kpi"\]/);
    assert.match(animations, /\[data-denali-skeleton-size="hero"\]/);
  });
});
