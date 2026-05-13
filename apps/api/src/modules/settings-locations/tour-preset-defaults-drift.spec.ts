import assert from "node:assert/strict";
import test from "node:test";

import type { TourFormProfile } from "@repo/types";

import {
  detectPresetThemeProfileDrift,
  formatPresetDriftWarning,
  type ThemeLookup,
} from "./tour-preset-defaults-drift";

function makeLookup(map: Record<string, TourFormProfile>): ThemeLookup {
  return async (id) => {
    const profile = map[id];
    return profile ? { id, formProfile: profile } : null;
  };
}

test("returns ok when there is no theme id at all", async () => {
  const result = await detectPresetThemeProfileDrift(
    {
      presetFormProfile: "general",
      defaultsOverviewMainTourThemeId: null,
      matchMainTourThemeId: null,
    },
    makeLookup({}),
  );
  assert.deepEqual(result, { ok: true });
});

test("returns ok when defaults theme id matches preset profile", async () => {
  const result = await detectPresetThemeProfileDrift(
    {
      presetFormProfile: "cinema_event",
      defaultsOverviewMainTourThemeId: "theme-cinema",
      matchMainTourThemeId: null,
    },
    makeLookup({ "theme-cinema": "cinema_event" }),
  );
  assert.deepEqual(result, { ok: true });
});

test("returns ok when legacy matchMainTourThemeId matches preset profile", async () => {
  const result = await detectPresetThemeProfileDrift(
    {
      presetFormProfile: "urban_event",
      defaultsOverviewMainTourThemeId: null,
      matchMainTourThemeId: "theme-urban",
    },
    makeLookup({ "theme-urban": "urban_event" }),
  );
  assert.deepEqual(result, { ok: true });
});

test("prefers defaults theme id over legacy column when both present", async () => {
  const result = await detectPresetThemeProfileDrift(
    {
      presetFormProfile: "cinema_event",
      defaultsOverviewMainTourThemeId: "theme-cinema",
      matchMainTourThemeId: "theme-urban",
    },
    makeLookup({ "theme-cinema": "cinema_event", "theme-urban": "urban_event" }),
  );
  assert.deepEqual(result, { ok: true });
});

test("returns preset_theme_not_in_workspace when lookup yields null", async () => {
  const result = await detectPresetThemeProfileDrift(
    {
      presetFormProfile: "general",
      defaultsOverviewMainTourThemeId: "ghost-theme",
      matchMainTourThemeId: null,
    },
    makeLookup({}),
  );
  assert.deepEqual(result, {
    ok: false,
    reason: "preset_theme_not_in_workspace",
    themeId: "ghost-theme",
    presetFormProfile: "general",
  });
});

test("returns preset_form_profile_mismatches_theme on actual drift", async () => {
  const result = await detectPresetThemeProfileDrift(
    {
      presetFormProfile: "urban_event",
      defaultsOverviewMainTourThemeId: "theme-x",
      matchMainTourThemeId: null,
    },
    makeLookup({ "theme-x": "cinema_event" }),
  );
  assert.deepEqual(result, {
    ok: false,
    reason: "preset_form_profile_mismatches_theme",
    themeId: "theme-x",
    presetFormProfile: "urban_event",
    themeFormProfile: "cinema_event",
  });
});

test("treats whitespace-only theme id as absent", async () => {
  const result = await detectPresetThemeProfileDrift(
    {
      presetFormProfile: "general",
      defaultsOverviewMainTourThemeId: "   ",
      matchMainTourThemeId: "",
    },
    makeLookup({}),
  );
  assert.deepEqual(result, { ok: true });
});

test("formatPresetDriftWarning returns null for ok result", () => {
  assert.equal(formatPresetDriftWarning({ ok: true }), null);
});

test("formatPresetDriftWarning formats preset_theme_not_in_workspace", () => {
  const msg = formatPresetDriftWarning({
    ok: false,
    reason: "preset_theme_not_in_workspace",
    themeId: "ghost-theme",
    presetFormProfile: "general",
  });
  assert.equal(typeof msg, "string");
  assert.match(msg as string, /\[presets\]\[drift\]/);
  assert.match(msg as string, /preset_theme_not_in_workspace/);
  assert.match(msg as string, /themeId=ghost-theme/);
  assert.match(msg as string, /presetFormProfile=general/);
});

test("formatPresetDriftWarning formats preset_form_profile_mismatches_theme", () => {
  const msg = formatPresetDriftWarning({
    ok: false,
    reason: "preset_form_profile_mismatches_theme",
    themeId: "theme-x",
    presetFormProfile: "urban_event",
    themeFormProfile: "cinema_event",
  });
  assert.equal(typeof msg, "string");
  assert.match(msg as string, /\[presets\]\[drift\]/);
  assert.match(msg as string, /preset_form_profile_mismatches_theme/);
  assert.match(msg as string, /themeId=theme-x/);
  assert.match(msg as string, /presetFormProfile=urban_event/);
  assert.match(msg as string, /themeFormProfile=cinema_event/);
});
