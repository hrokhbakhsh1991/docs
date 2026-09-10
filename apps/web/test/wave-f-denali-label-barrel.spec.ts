/**
 * Wave F.d — shell Denali label barrel deleted; tests use package SoT.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(WEB_ROOT, "../..");

describe("wave-f-denali-label-barrel.spec.ts — Wave F.d", () => {
  it("F.d-01 wizard-labels.ts is deleted", () => {
    assert.equal(existsSync(join(WEB_ROOT, "src/wizard/denali/wizard-labels.ts")), false);
  });

  it("F.d-02 no apps/web src imports wizard/denali/wizard-labels", () => {
    const sources = [
      "src/admin/patterns/tour-category-badge.tsx",
      "src/tours/wizard-template-field-labels.ts",
      "src/wizard/wizard-label-surface-registry.ts",
      "app/(app)/tours/tours-page-client.tsx",
      "app/(app)/tours/tours-directory-table.tsx",
      "app/(app)/tours/tour-list-row-actions.tsx",
      "app/(app)/settings/tour-wizard-template/wizard-template-client.tsx",
    ];
    for (const rel of sources) {
      const abs = join(WEB_ROOT, rel);
      if (!existsSync(abs)) {
        continue;
      }
      const source = readFileSync(abs, "utf8");
      assert.doesNotMatch(source, /wizard\/denali\/wizard-labels/);
    }
  });

  it("F.d-03 denaliMessagesFromAppMessages is test-only helper", () => {
    const helper = join(WEB_ROOT, "test/helpers/denali-messages-from-app.ts");
    assert.ok(existsSync(helper));
    const source = readFileSync(helper, "utf8");
    assert.match(source, /denaliMessagesFromAppMessages/);
    assert.match(source, /isDenaliWizardMessages/);
    assert.equal(existsSync(join(WEB_ROOT, "src/wizard/denali/wizard-labels.ts")), false);
  });

  it("F.d-04 package still owns field-labels-from-messages SoT", () => {
    assert.ok(
      existsSync(
        join(
          REPO_ROOT,
          "packages/workspaces/denali/src/ui/adapters/field-labels-from-messages.ts"
        )
      )
    );
  });
});
