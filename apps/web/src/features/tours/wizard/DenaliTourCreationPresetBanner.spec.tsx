/**
 * Regression: Denali in-wizard preset apply uses factory orchestration (single hydration authority).
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

test("DenaliTourCreationPresetBanner applies presets via applyDenaliWizardPreset (factory orchestrator)", () => {
  assert.match(bannerSource, /applyDenaliWizardPreset/);
  assert.match(bannerSource, /wizardTemplate/);
  assert.doesNotMatch(bannerSource, /tryHydrateCanonicalTemplate/);
  assert.doesNotMatch(bannerSource, /finalizeDenaliWizardHydration/);
  assert.doesNotMatch(bannerSource, /useFormContext\s*\(/);
  assert.doesNotMatch(bannerSource, /presetDefaultsToDenaliFormPatch/);
});

test("DenaliTourCreationPresetBanner receives formMethods from plugin context (no RHF context)", () => {
  assert.match(bannerSource, /formMethods:/);
  assert.match(bannerSource, /const \{ reset \} = formMethods/);
});

test("DenaliTourCreationPresetBanner exposes wizard test ids", () => {
  assert.match(bannerSource, /data-testid="workspace-wizard-preset-select"/);
  assert.match(bannerSource, /data-testid="workspace-wizard-preset-apply"/);
  assert.match(bannerSource, /data-testid="workspace-wizard-preset-clear"/);
});
