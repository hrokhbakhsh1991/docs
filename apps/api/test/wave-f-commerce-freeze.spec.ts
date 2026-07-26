/**
 * Wave F.b — frozen commerce comes from manifest codegen, not hard-coded denali branches.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  isWorkspaceCommerceFrozen,
  resolveFrozenWorkspaceCommerce,
} from "@app-tour/workspace-sdk/metadata";

const REPO_ROOT = join(import.meta.dirname, "../../..");

describe("wave-f-commerce-freeze.spec.ts — Wave F.b", () => {
  it("F.b-01 denali workspace type is frozen offline_receipt", () => {
    assert.equal(isWorkspaceCommerceFrozen("denali"), true);
    assert.equal(isWorkspaceCommerceFrozen("urban"), false);
    assert.deepEqual(resolveFrozenWorkspaceCommerce("denali"), {
      paymentMode: "offline_receipt",
      gatewayProvider: null,
      currency: "IRR",
    });
  });

  it("F.b-02 API/web commerce paths have no hard-coded denali equality", () => {
    for (const rel of [
      "apps/api/src/workspace-metadata/resolve-workspace-commerce-for-tenant.ts",
      "apps/api/src/tours/apply-workspace-commerce-create-default.ts",
      "apps/web/src/platform/club-commerce-badge.tsx",
    ]) {
      const source = readFileSync(join(REPO_ROOT, rel), "utf8");
      assert.doesNotMatch(source, /===\s*["']denali["']/, rel);
      assert.match(source, /Frozen|frozen|resolveFrozenWorkspaceCommerce|isWorkspaceCommerceFrozen/, rel);
    }
  });
});
