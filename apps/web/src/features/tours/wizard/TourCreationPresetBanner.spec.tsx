/**
 * Regression: in-wizard preset apply uses the same facade as URL bootstrap ({@link mapWizardPrefillToFormPatch}).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";

import { applyTourCreationPreset } from "./tourCreationPresetApply";

const bannerSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "TourCreationPresetBanner.tsx"),
  "utf8",
);

test("TourCreationPresetBanner applies presets via applyTourCreationPreset (shared pipeline)", () => {
  assert.match(bannerSource, /applyTourCreationPreset\(/);
  assert.doesNotMatch(bannerSource, /mapPresetToFormPatch\(/);
  assert.doesNotMatch(bannerSource, /mapWizardPrefillToFormPatch\(/);
  assert.match(bannerSource, /matchTourType:\s*selected\.matchTourType/);
});

test("TourCreationPresetBanner waits for workspace template before apply (no general fallback)", () => {
  assert.match(bannerSource, /useTenantWizardTemplate/);
  assert.match(bannerSource, /workspaceFormProfile/);
  assert.doesNotMatch(bannerSource, /\?\?\s*["']general["']/);
  assert.match(bannerSource, /!templateReady\s*\|\|\s*workspaceFormProfile\s*==\s*null/);
});

test("applyTourCreationPreset routes preset defaults through mapWizardPrefillToFormPatch", () => {
  const merged = applyTourCreationPreset({
    resolvedFormProfile: "mountain_outdoor",
    defaults: {
      overview: {
        title: "Mountain preset via facade",
        tourType: "mountain",
      },
    },
    baseValues: buildTourCreateFormDefaultValues(),
    themeCatalog: [],
  });

  assert.equal(merged.overview?.title, "Mountain preset via facade");
  assert.equal(merged.overview?.tourType, "mountain");
});
