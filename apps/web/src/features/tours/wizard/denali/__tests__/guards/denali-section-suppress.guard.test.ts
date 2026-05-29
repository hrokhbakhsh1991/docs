/**
 * Structural guard: flat-edit section suppress uses registry canonical paths.
 */
import assert from "node:assert/strict";

import {
  DENALI_EDIT_SECTION_IDS,
  getSuppressedCanonicalPathsForSection,
  listEditFlatSuppressedCanonicalPaths,
} from "@/features/tours/denali/fields/denaliSectionSuppress";

import { describeStructuralGuard } from "@/features/tours/wizard/testing/structural-guard";

describeStructuralGuard("denali flat-edit section suppress", [
  {
    name: "uses registry canonical paths (not legacy RHF-style names)",
    run: () => {
      const union = new Set(listEditFlatSuppressedCanonicalPaths());
      assert.equal(union.has("transport.mode"), true);
      assert.equal(union.has("pricing.basePricePerPerson"), true);
      assert.equal(union.has("participants.minimumAge"), true);
      assert.equal(union.has("policies.policiesText"), true);
      assert.equal(union.has("transport.transportMode"), false);
      assert.equal(union.has("pricingPayment.basePrice"), false);
    },
  },
  {
    name: "covers every in-rule-model path per edit section",
    run: () => {
      for (const sectionId of DENALI_EDIT_SECTION_IDS) {
        const suppressed = getSuppressedCanonicalPathsForSection(sectionId);
        assert.ok(suppressed.size > 0, `expected suppress paths for ${sectionId}`);
      }
    },
  },
]);
