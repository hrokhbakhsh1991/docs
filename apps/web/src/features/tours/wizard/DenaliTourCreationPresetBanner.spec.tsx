/**
 * Regression: Denali in-wizard preset apply uses shared domain hydration pipeline.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const bannerSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "DenaliTourCreationPresetBanner.tsx"),
  "utf8",
);

test("DenaliTourCreationPresetBanner applies presets via applyDenaliWizardPreset + finalizeDenaliWizardHydration", () => {
  assert.match(bannerSource, /applyDenaliWizardPreset/);
  assert.match(bannerSource, /finalizeDenaliWizardHydration/);
  assert.doesNotMatch(bannerSource, /useFormContext/);
  assert.doesNotMatch(bannerSource, /presetDefaultsToDenaliFormPatch/);
});

test("DenaliTourCreationPresetBanner receives formMethods from plugin context (no RHF context)", () => {
  assert.match(bannerSource, /formMethods:/);
  assert.match(bannerSource, /const \{ getValues, reset \} = formMethods/);
});

test("DenaliTourCreationPresetBanner exposes wizard test ids", () => {
  assert.match(bannerSource, /data-testid="denali-wizard-preset-select"/);
  assert.match(bannerSource, /data-testid="denali-wizard-preset-apply"/);
  assert.match(bannerSource, /data-testid="denali-wizard-preset-clear"/);
});
