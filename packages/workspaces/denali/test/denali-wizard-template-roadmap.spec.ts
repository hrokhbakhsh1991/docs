import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDenaliWorkspaceFieldRegistry } from "../src/denali-plugin-adapter";
import {
  DENALI_WIZARD_PALETTE_ROADMAP_CANONICAL_PATHS,
  isDenaliWizardPaletteRoadmapCanonicalPath,
  isWizardPaletteRoadmapRegistryField,
  WIZARD_PALETTE_ROADMAP_TAG,
} from "../src/settings/denali-wizard-template-roadmap";
import { shouldRenderDenaliRegistryField } from "../src/composites/denali-composite-anchors";
import { findDenaliFieldDefinition } from "../src/settings/denali-wizard-template-catalog-meta";

describe("denali-wizard-template-roadmap.spec.ts", () => {
  it("DN-ROADMAP-01 registry exposes roadmap rows with palette tag and no wizard renderer", () => {
    const registry = buildDenaliWorkspaceFieldRegistry();
    for (const path of DENALI_WIZARD_PALETTE_ROADMAP_CANONICAL_PATHS) {
      assert.equal(isDenaliWizardPaletteRoadmapCanonicalPath(path), true);
      const row = registry.fields.find((field) => field.canonicalPath === path);
      assert.ok(row, `missing registry row for ${path}`);
      assert.equal(isWizardPaletteRoadmapRegistryField(row), true);
      assert.equal(row.tags?.includes(WIZARD_PALETTE_ROADMAP_TAG), true);

      const def = findDenaliFieldDefinition(path);
      assert.ok(def);
      assert.equal(def.settingsSurface, "palette_roadmap");
      assert.equal(shouldRenderDenaliRegistryField(def), false);
    }
  });
});
