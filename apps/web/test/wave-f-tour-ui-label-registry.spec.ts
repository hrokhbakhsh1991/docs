/**
 * Wave F.c — tour/admin UI uses label registry, not Denali barrel.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = join(import.meta.dirname, "..");

const TOUR_UI_FILES = [
  "src/admin/patterns/tour-category-badge.tsx",
  "app/(app)/tours/tours-page-client.tsx",
  "app/(app)/tours/tours-directory-table.tsx",
  "app/(app)/tours/tour-list-row-actions.tsx",
  "app/(app)/tours/[id]/workspace/transport/tour-workspace-transport-client.tsx",
  "app/(app)/tours/[id]/workspace/transport/page.tsx",
  "app/(app)/settings/tour-wizard-template/wizard-template-client.tsx",
] as const;

describe("wave-f-tour-ui-label-registry.spec.ts — Wave F.c", () => {
  it("F.c-01 tour UI files do not import @/wizard/denali/wizard-labels", () => {
    for (const rel of TOUR_UI_FILES) {
      const source = readFileSync(join(WEB_ROOT, rel), "utf8");
      assert.doesNotMatch(
        source,
        /@\/wizard\/denali\/wizard-labels/,
        `forbidden denali label barrel in ${rel}`
      );
      assert.doesNotMatch(
        source,
        /resolveDenaliTour(Kind|Duration|CategoryGroup)Label|resolveDenaliTransportModeLabel|resolveDenaliField(Kind)?Label/,
        `forbidden resolveDenali* label call in ${rel}`
      );
    }
  });

  it("F.c-02 registry exports catalog helpers over enum paths", () => {
    const source = readFileSync(
      join(WEB_ROOT, "src/wizard/wizard-label-surface-registry.ts"),
      "utf8"
    );
    assert.match(source, /WIZARD_CATALOG_ENUM_PATHS/);
    assert.match(source, /resolveWizardTourKindLabel/);
    assert.match(source, /resolveWizardTourDurationLabel/);
    assert.match(source, /resolveWizardTourCategoryGroupLabel/);
    assert.match(source, /resolveWizardTransportModeLabel/);
    assert.match(source, /tour\.duration/);
    assert.match(source, /tour\.categoryGroup/);
  });

  it("F.c-03 transport UI resolves labels through the plugin-aware client", () => {
    const page = readFileSync(
      join(WEB_ROOT, "app/(app)/tours/[id]/workspace/transport/page.tsx"),
      "utf8"
    );
    const client = readFileSync(
      join(
        WEB_ROOT,
        "app/(app)/tours/[id]/workspace/transport/tour-workspace-transport-client.tsx"
      ),
      "utf8"
    );
    assert.match(page, /redirect\(hrefForWorkspaceTab\(id,\s*"transport"\)\)/);
    assert.match(client, /readonly pluginId: string/);
    assert.match(client, /resolveWizardTransportModeLabel/);
    assert.match(client, /useWorkspaceWizardTranslator/);
  });
});
