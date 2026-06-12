import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "../src/rules/generated/denaliCanonicalPathMap.generated";
import { resolveDenaliCompositeRendererId } from "../src/composites/denali-composite-registry";
import { DENALI_FIELD_DEFINITIONS } from "../src/field-registry/denaliFieldRegistryData";
import {
  getCanonicalValueFromDraft,
  setCanonicalValueOnDraft,
} from "../src/wizard/canonical-draft-access";
import { sanitizeGuideLanguageIdsOnDraft } from "../src/wizard/denali-wizard-catalog-sanitize";

describe("denali-guide-language-ids.spec.ts — Phase 12.5", () => {
  it("DEN-12.5-01 codegen map includes program.guideLanguageIds", () => {
    assert.equal(
      DENALI_CANONICAL_TO_FORM_PATH_MAP["program.guideLanguageIds"],
      "programNature.guideLanguageIds"
    );
    const field = DENALI_FIELD_DEFINITIONS.find(
      (entry) => entry.canonicalPath === "program.guideLanguageIds"
    );
    assert.ok(field);
    assert.equal(resolveDenaliCompositeRendererId(field!), "denali.guide-language-ids");
  });

  it("DEN-12.5-02 sanitizeGuideLanguageIdsOnDraft drops stale ids", () => {
    let envelope = { data: {} };
    envelope = setCanonicalValueOnDraft(envelope, "program.guideLanguageIds", [
      "gl-active",
      "gl-stale",
    ]);
    envelope = sanitizeGuideLanguageIdsOnDraft(envelope, ["gl-active"]);
    assert.deepEqual(getCanonicalValueFromDraft(envelope, "program.guideLanguageIds"), [
      "gl-active",
    ]);
  });
});
