/**
 * Structural guard: flat-edit sections render registry rows via DenaliFieldRenderer.
 */
import assert from "node:assert/strict";

import { getDenaliFieldRegistryByStep } from "@repo/denali-domain";

import {
  DENALI_EDIT_SECTION_IDS,
} from "@/features/tours/denali/fields/denaliSectionSuppress";
import { shouldRenderDenaliRegistryField } from "@/features/tours/denali/fields/denaliFieldRendererAnchors";

import { describeStructuralGuard } from "@/features/tours/wizard/testing/structural-guard";

describeStructuralGuard("denali flat-edit registry sections", [
  {
    name: "every edit section has in-rule-model registry rows",
    run: () => {
      for (const sectionId of DENALI_EDIT_SECTION_IDS) {
        const rows = getDenaliFieldRegistryByStep(sectionId).filter(
          (row) => row.inRuleModel !== false && shouldRenderDenaliRegistryField(row),
        );
        assert.ok(rows.length > 0, `expected registry rows for ${sectionId}`);
      }
    },
  },
  {
    name: "uses canonical paths (not legacy RHF-style names)",
    run: () => {
      const basic = getDenaliFieldRegistryByStep("denali_basic");
      assert.equal(basic.some((row) => row.canonicalPath === "destinationId"), true);
      assert.equal(basic.some((row) => row.canonicalPath === "basicInfo.destinationId"), false);
    },
  },
]);
