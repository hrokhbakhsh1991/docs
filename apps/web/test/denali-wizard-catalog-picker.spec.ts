import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const DENALI_ROOT = join(import.meta.dirname, "../../../packages/workspaces/denali");
const WEB_ROOT = join(import.meta.dirname, "..");

describe("denali-wizard-catalog-picker.spec.ts", () => {
  it("DN-WIZ-PICKER-01 guide languages use searchable catalog multi-picker", () => {
    const field = readFileSync(
      join(DENALI_ROOT, "src/ui/fields/denali-guide-language-ids-field.tsx"),
      "utf8"
    );
    assert.match(field, /DenaliCatalogMultiPicker/);
    assert.doesNotMatch(field, /<Checkbox/);
    const picker = readFileSync(
      join(DENALI_ROOT, "src/ui/components/denali-catalog-multi-picker.tsx"),
      "utf8"
    );
    assert.match(picker, /denali-wizard-picker__scroll/);
  });

  it("DN-WIZ-PICKER-02 gear picker collapses with chip summary", () => {
    const field = readFileSync(join(DENALI_ROOT, "src/ui/fields/denali-gear-field.tsx"), "utf8");
    assert.match(field, /denali-gear-picker__collapsed/);
    assert.match(field, /denali-wizard-picker__scroll/);
    assert.match(field, /pickerExpanded/);
  });

  it("DN-WIZ-PICKER-03 create wizard step change reads latest envelope ref", () => {
    const core = readFileSync(
      join(DENALI_ROOT, "src/ui/chrome/use-create-tour-wizard-core.ts"),
      "utf8"
    );
    assert.match(core, /buildDenaliWizardStepChangeFromLatestRef/);
    assert.match(core, /denaliEnvelopeRef\.current/);
    assert.match(core, /await input\.draftSync\.flush\(\)/);
    assert.doesNotMatch(core, /denaliEnvelope\.form/);
  });

  it("DN-WIZ-PICKER-04 wizard shell awaits async step navigation", () => {
    const shell = readFileSync(join(WEB_ROOT, "src/wizard/wizard-step-shell.tsx"), "utf8");
    assert.match(shell, /stepNavInFlight/);
    assert.match(shell, /advanceToIndex/);
    assert.match(shell, /await advanceToIndex/);
  });

  it("DN-WIZ-PICKER-05 program content themes use searchable catalog multi-picker", () => {
    const field = readFileSync(
      join(DENALI_ROOT, "src/ui/fields/denali-program-content-field.tsx"),
      "utf8"
    );
    assert.match(field, /DenaliCatalogMultiPicker/);
    assert.match(field, /TourThemeCatalogAvatar/);
    assert.doesNotMatch(field, /themeDisplayInitials/);
    assert.doesNotMatch(field, /denali-theme-picker__grid/);
  });

  it("DN-WIZ-PICKER-06 flat edit shares wizard picker composites", () => {
    const flatChrome = readFileSync(join(WEB_ROOT, "src/wizard/flat-edit-chrome.tsx"), "utf8");
    assert.match(flatChrome, /data-new-tour-wizard/);
    const guideField = readFileSync(
      join(DENALI_ROOT, "src/ui/fields/denali-guide-language-ids-field.tsx"),
      "utf8"
    );
    const gearField = readFileSync(join(DENALI_ROOT, "src/ui/fields/denali-gear-field.tsx"), "utf8");
    assert.match(guideField, /DenaliCatalogMultiPicker/);
    assert.match(gearField, /denali-wizard-picker__scroll/);
  });
});
