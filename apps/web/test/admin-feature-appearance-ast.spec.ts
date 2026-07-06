/**
 * F7 — admin feature TSX semantic-only className contract.
 * @see docs/dev/dtcg-pipeline-spec.mdoc § F7
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ADMIN_FEATURE_SCAN_DIRS,
  scanAdminFeatureAppearance,
} from "../../../scripts/guards/lib/admin-feature-appearance-ast-scan.mjs";

const REPO_ROOT = new URL("../../..", import.meta.url).pathname;

describe("admin-feature-appearance-ast.spec.ts", () => {
  it("F7-01 scans patterns, dashboard, and onboarding TSX", () => {
    const { scanned } = scanAdminFeatureAppearance(REPO_ROOT);
    assert.ok(scanned >= 10, `expected feature TSX files, got ${scanned}`);
    assert.deepEqual(ADMIN_FEATURE_SCAN_DIRS, [
      "apps/web/src/admin/patterns",
      "apps/web/src/admin/dashboard",
      "apps/web/src/admin/onboarding",
    ]);
  });

  it("F7-02 feature className uses semantic tokens only (no palette / hex)", () => {
    const { violations } = scanAdminFeatureAppearance(REPO_ROOT);
    assert.deepEqual(
      violations,
      [],
      violations.length > 0 ? violations.join("\n") : undefined,
    );
  });
});
