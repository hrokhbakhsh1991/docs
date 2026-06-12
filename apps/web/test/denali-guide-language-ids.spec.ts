/**
 * Denali guide languages composite — Phase 12.5
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { getCanonicalValue, setCanonicalValue } from "../src/tours/tour-wizard-draft-path";
import {
  isDenaliCompositeImplemented,
  DENALI_IMPLEMENTED_COMPOSITE_IDS,
} from "../src/wizard/denali/denali-composite-ids";
import { DENALI_GUIDE_LANGUAGES_TEST_IDS } from "../src/wizard/denali/denali-guide-language-ids-field";
import {
  readActiveGuideLanguageIds,
  sanitizeGuideLanguageIdsOnDraft,
} from "../src/wizard/denali/denali-catalog-sanitize";

describe("denali-guide-language-ids.spec.ts", () => {
  it("WEB-12.5-01 composite id is registered and exposed for render", () => {
    assert.ok(DENALI_IMPLEMENTED_COMPOSITE_IDS.includes("denali.guide-language-ids"));
    assert.equal(isDenaliCompositeImplemented("denali.guide-language-ids"), true);
    assert.equal(
      DENALI_GUIDE_LANGUAGES_TEST_IDS.guideLanguages,
      "denali-composite-guide-language-ids"
    );
  });

  it("WEB-12.5-02 readActiveGuideLanguageIds and sanitize drop inactive/stale ids", () => {
    assert.deepEqual(
      readActiveGuideLanguageIds([
        { id: " gl-1 ", isActive: true },
        { id: "gl-2", isActive: false },
        { id: "", isActive: true },
      ]),
      ["gl-1"]
    );

    let draft = setCanonicalValue(emptyTourWizardDraft(), "program.guideLanguageIds", [
      "gl-active",
      "gl-stale",
    ]);
    draft = sanitizeGuideLanguageIdsOnDraft(draft, ["gl-active"]);
    assert.deepEqual(getCanonicalValue(draft, "program.guideLanguageIds"), ["gl-active"]);
  });
});
