/**
 * Phase 9.6 — SMK-P9-05 wizard template prefill
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "../src/tours/tour-wizard-draft-path";
import { buildWizardTemplateFieldOverlays } from "../src/tours/wizard-template-gate-logic";
import {
  applyWizardTemplateDefaultsToDraft,
  applyWizardTemplatePrefillToDraft,
  applyWizardTemplateSeedToDraft,
  ensureDenaliWizardDraftDefaults,
  extractSeedLabelFromTemplateResponse,
  parseWizardTemplateSeedForPrefill,
  resolveWizardTemplateSeedCanonicalPath,
  shouldAttachSeedPrefillTestId,
  WIZARD_TEMPLATE_PREFILL_TEST_IDS,
  WIZARD_TEMPLATE_SEED_CANONICAL_PATH,
  WIZARD_TEMPLATE_SEED_CANONICAL_PATH_DENALI,
} from "../src/tours/wizard-template-prefill-logic";

describe("wizard-template-prefill.spec.ts — SMK-P9-05", () => {
  it("WEB-9.6-SMK-P9-05 seed maps to basics.title when empty", () => {
    assert.equal(WIZARD_TEMPLATE_SEED_CANONICAL_PATH, "basics.title");
    assert.equal(WIZARD_TEMPLATE_SEED_CANONICAL_PATH_DENALI, "title");
    assert.equal(
      WIZARD_TEMPLATE_PREFILL_TEST_IDS.seedPrefillField,
      "operator-wizard-template-seed-prefill"
    );

    const draft = applyWizardTemplateSeedToDraft(emptyTourWizardDraft(), "SMK-P9-SEED");
    assert.equal(getCanonicalStringValue(draft, "basics.title"), "SMK-P9-SEED");
    assert.equal(shouldAttachSeedPrefillTestId("basics.title"), true);
    assert.equal(shouldAttachSeedPrefillTestId("details.summary"), false);
  });

  it("WEB-9.6-SMK-P9-05 denali seed maps to title when empty", () => {
    assert.equal(resolveWizardTemplateSeedCanonicalPath("denali"), "title");
    const draft = applyWizardTemplateSeedToDraft(emptyTourWizardDraft(), "SMK-P9-SEED", "denali");
    assert.equal(getCanonicalStringValue(draft, "title"), "SMK-P9-SEED");
    assert.equal(shouldAttachSeedPrefillTestId("title", "denali"), true);
    assert.equal(shouldAttachSeedPrefillTestId("basics.title", "denali"), false);
  });

  it("WEB-9.6-SMK-P9-05 does not overwrite existing title", () => {
    const seeded = applyWizardTemplateSeedToDraft(emptyTourWizardDraft(), "SMK-P9-SEED");
    const again = applyWizardTemplateSeedToDraft(seeded, "OTHER-SEED");
    assert.equal(getCanonicalStringValue(again, "basics.title"), "SMK-P9-SEED");
  });

  it("WEB-9.6-SMK-P9-05 parses BFF template response", () => {
    const seed = parseWizardTemplateSeedForPrefill({
      configKey: "wizard_template",
      configVersion: 1,
      source: "tenant",
      updatedAt: new Date().toISOString(),
      payload: {
        seedLabel: "SMK-P9-SEED",
        sections: [{ id: "basics", label: "Basics", enabled: true }],
      },
    });
    assert.equal(seed, "SMK-P9-SEED");
    assert.equal(
      extractSeedLabelFromTemplateResponse({ payload: { seedLabel: "  trimmed  " } }),
      "trimmed"
    );
  });

  it("WEB-9.6-WIZ-08 applyWizardTemplateDefaultsToDraft prefills empty canonical paths", () => {
    const overlays = buildWizardTemplateFieldOverlays([
      {
        stepId: "details",
        label: "Details",
        enabled: true,
        fields: [{ canonicalPath: "details.summary", defaultValue: "Default summary" }],
      },
    ]);
    const draft = applyWizardTemplateDefaultsToDraft(emptyTourWizardDraft(), overlays);
    assert.equal(getCanonicalStringValue(draft, "details.summary"), "Default summary");
  });

  it("WEB-9.6-WIZ-09 seedLabel wins over defaultValue on title path", () => {
    const overlays = buildWizardTemplateFieldOverlays([
      {
        stepId: "basics",
        label: "Basics",
        enabled: true,
        fields: [{ canonicalPath: "basics.title", defaultValue: "Default title" }],
      },
    ]);
    const draft = applyWizardTemplatePrefillToDraft(
      emptyTourWizardDraft(),
      "SMK-P9-SEED",
      overlays,
      "starter"
    );
    assert.equal(getCanonicalStringValue(draft, "basics.title"), "SMK-P9-SEED");
  });

  it("denali prefill sets publishStatus draft when template includes review field", () => {
    const overlays = buildWizardTemplateFieldOverlays([
      {
        stepId: "review",
        label: "Review",
        enabled: true,
        fields: [{ canonicalPath: "publishStatus" }],
      },
    ]);
    const draft = applyWizardTemplatePrefillToDraft(
      emptyTourWizardDraft(),
      "",
      overlays,
      "denali"
    );
    assert.equal(getCanonicalStringValue(draft, "publishStatus"), "draft");
  });

  it("denali prefill seeds default category slug (mountain_day)", () => {
    const draft = applyWizardTemplatePrefillToDraft(
      emptyTourWizardDraft(),
      "تور جدید",
      new Map(),
      "denali"
    );
    assert.equal(getCanonicalStringValue(draft, "category"), "mountain_day");
  });

  it("ensureDenaliWizardDraftDefaults migrates hydrated drafts missing category", () => {
    const draft = ensureDenaliWizardDraftDefaults(
      setCanonicalStringValue(emptyTourWizardDraft(), "title", "Saved draft")
    );
    assert.equal(getCanonicalStringValue(draft, "category"), "mountain_day");
    assert.equal(getCanonicalStringValue(draft, "title"), "Saved draft");
  });
});
