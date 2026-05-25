/**
 * Regression: Denali in-wizard preset apply uses {@link applyDenaliWizardPreset} (shared with URL bootstrap).
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

test("DenaliTourCreationPresetBanner applies presets via applyDenaliWizardPreset (shared pipeline)", () => {
  assert.match(bannerSource, /applyDenaliWizardPreset\(/);
  assert.match(bannerSource, /mapTemplateToRuleModel/);
  assert.match(bannerSource, /ruleSet:\s*mergedRuleSet/);
  assert.doesNotMatch(bannerSource, /mapPresetToFormPatch\(/);
  assert.doesNotMatch(bannerSource, /presetDefaultsToDenaliFormPatch/);
  assert.doesNotMatch(bannerSource, /getTours\(/);
});

test("DenaliTourCreationPresetBanner waits for workspace template before apply (no general fallback)", () => {
  assert.match(bannerSource, /useTenantWizardTemplate/);
  assert.match(bannerSource, /workspaceFormProfile/);
  assert.doesNotMatch(bannerSource, /\?\?\s*["']general["']/);
  assert.match(bannerSource, /!templateReady\s*\|\|\s*workspaceFormProfile\s*==\s*null/);
});

test("DenaliTourCreationPresetBanner exposes wizard test ids", () => {
  assert.match(bannerSource, /data-testid="denali-wizard-preset-select"/);
  assert.match(bannerSource, /data-testid="denali-wizard-preset-apply"/);
});
