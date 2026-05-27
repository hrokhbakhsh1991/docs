import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";

import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";

import { applyTourWizardPatch } from "./applyTourWizardPatch";
import { mapFormValuesToBackendPayload } from "./domain/mapWizardFormToCreateTourPayload";
import {
  filterFormPatchByActiveGroups,
  sanitizeInactiveRootsForProfile,
  stripInactiveTourCreateGroupsForProfile,
} from "./fieldGroups";
import { mergeTourFormPatch } from "./tourCreateWizardMerge";
import { buildTourCreateFormDefaultValues } from "./tourCreateFormDefaults";
import { presetDefaultsToFormPatch } from "./tourCreationPresetMatch";
import type { ThemeRowForProfile } from "./tourWizardProfileResolve";

/**
 * Phase-1 pipeline migration: only the preset apply call site is wired to
 * `applyTourWizardPatch` (see `TourCreationPresetBanner.applySelected`).
 *
 * These tests pin the pipeline's contract — final-profile re-resolution,
 * patch filter against the FINAL profile, merge, and sanitize — so future
 * migrations (clone bootstrap, server snapshot merge) can reuse the same seam
 * without behaviour drift.
 */

const THEME_CINEMA = "11111111-1111-4111-8111-111111111111";
const THEME_URBAN = "22222222-2222-4222-8222-222222222222";
const THEME_MOUNTAIN = "33333333-3333-4333-8333-333333333333";
/** Valid v4 UUID not present in `themeCatalog` (catalog miss + tourType fallback). */
const THEME_GHOST = "44444444-4444-4444-8444-444444444444";

const themeCatalog: ThemeRowForProfile[] = [
  { id: THEME_CINEMA, formProfile: "cinema_event" },
  { id: THEME_URBAN, formProfile: "urban_event" },
  { id: THEME_MOUNTAIN, formProfile: "mountain_outdoor" },
];

function makeBase(overrides?: Partial<TourCreateFormValues>): TourCreateFormValues {
  const base = buildTourCreateFormDefaultValues();
  return overrides ? { ...base, ...overrides } : base;
}

test("returns currentProfile unchanged when patch is undefined", () => {
  const base = makeBase();
  const result = applyTourWizardPatch({
    baseValues: base,
    patch: undefined,
    currentProfile: "urban_event",
    themeCatalog,
  });
  assert.equal(result.resolvedFormProfile, "urban_event");
  assert.equal(result.filteredPatch, undefined);
  // mergeTourFormPatch returns base when patch is undefined, then sanitize against urban_event
  // resets itinerary / participation / logistics roots to canonical defaults.
  const expected = sanitizeInactiveRootsForProfile(base, "urban_event");
  assert.deepEqual(result.mergedValues, expected);
});

test("does not re-resolve profile when patch carries neither mainTourThemeId nor tourType", () => {
  const base = makeBase();
  base.overview.title = "kept";
  const patch: Partial<TourCreateFormValues> = {
    overview: { title: "from-preset" } as TourCreateFormValues["overview"],
    pricing: { basePrice: 1_000_000 } as TourCreateFormValues["pricing"],
  };
  const result = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "mountain_outdoor",
    themeCatalog,
    tourType: "mountain",
  });
  assert.equal(result.resolvedFormProfile, "mountain_outdoor", "caller's currentProfile wins");
  assert.equal(result.mergedValues.overview.title, "from-preset");
  assert.equal(result.mergedValues.pricing.basePrice, 1_000_000);
});

test("workspace profile: patch mainTourThemeId does not change resolved profile", () => {
  const base = makeBase();
  const patch: Partial<TourCreateFormValues> = {
    overview: { mainTourThemeId: THEME_CINEMA } as TourCreateFormValues["overview"],
  };
  const result = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "urban_event",
    themeCatalog,
  });
  assert.equal(result.resolvedFormProfile, "urban_event");
  assert.equal(result.mergedValues.overview.mainTourThemeId, THEME_CINEMA);
});

test("wizard: preset theme/tourType does not override workspace currentProfile", () => {
  const base = makeBase();
  const patch: Partial<TourCreateFormValues> = {
    overview: {
      mainTourThemeId: THEME_CINEMA,
      tourType: "city",
    } as TourCreateFormValues["overview"],
  };
  const result = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "mountain_outdoor",
    themeCatalog,
  });
  assert.equal(result.resolvedFormProfile, "mountain_outdoor");
  assert.equal(result.mergedValues.overview.mainTourThemeId, THEME_CINEMA);
  assert.equal(result.mergedValues.overview.tourType, "city");
});

test("filters patch against workspace cinema profile (preset drops inactive roots)", () => {
  const base = makeBase();
  const presetDefaults: Record<string, unknown> = {
    overview: { title: "presets", mainTourThemeId: THEME_CINEMA },
    itinerary: { days: [{ dayNumber: 1, segments: [{ title: "must-not-merge" }] }] },
    participation: { minimumAge: 18, requirements: "must-not-merge-participation" },
    logistics: { primaryTransportMode: "bus" },
  };
  const patch = presetDefaultsToFormPatch(presetDefaults);
  const result = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "cinema_event",
    themeCatalog,
  });
  assert.equal(result.resolvedFormProfile, "cinema_event");
  assert.equal(result.mergedValues.overview.title, "presets");
  assert.equal(result.mergedValues.overview.mainTourThemeId, THEME_CINEMA);
  // itinerary + participation are inactive for cinema_event → filtered out before merge,
  // and the final sanitize keeps them at canonical defaults.
  assert.deepEqual(result.mergedValues.itinerary, { days: [] });
  assert.equal(result.mergedValues.participation.requirements, "");
  // logistics is *active* for cinema_event → merged from patch.
  assert.equal(result.mergedValues.logistics.primaryTransportMode, "bus");
  assert.ok(result.filteredPatch);
  assert.ok(!("itinerary" in result.filteredPatch!));
  assert.ok(!("participation" in result.filteredPatch!));
  assert.ok("logistics" in result.filteredPatch!);
});

test("urban_event workspace profile drops logistics from preset patch", () => {
  const base = makeBase();
  base.logistics.primaryTransportMode = "bus"; // pre-existing user input
  base.logistics.fuelShareToman = 250_000;
  const presetDefaults: Record<string, unknown> = {
    overview: { title: "urban-preset", mainTourThemeId: THEME_URBAN },
    itinerary: { days: [{ dayNumber: 1, segments: [{ title: "x" }] }] },
    participation: { minimumAge: 18 },
    logistics: { primaryTransportMode: "plane", fuelShareToman: 999_999 },
  };
  const patch = presetDefaultsToFormPatch(presetDefaults);
  const result = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "urban_event",
    themeCatalog,
  });
  assert.equal(result.resolvedFormProfile, "urban_event");
  assert.equal(result.mergedValues.overview.title, "urban-preset");
  // urban_event makes logistics inactive too → ghost from base must also be reset.
  const defaults = buildTourCreateFormDefaultValues();
  assert.deepEqual(result.mergedValues.itinerary, { days: [] });
  assert.deepEqual(result.mergedValues.participation, defaults.participation);
  assert.deepEqual(result.mergedValues.logistics, defaults.logistics);
});

test("workspace profile unchanged when patch has unknown theme id and city tourType", () => {
  const base = makeBase();
  const patch: Partial<TourCreateFormValues> = {
    overview: { mainTourThemeId: THEME_GHOST, tourType: "city" } as TourCreateFormValues["overview"],
  };
  const result = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "mountain_outdoor",
    themeCatalog,
  });
  assert.equal(result.resolvedFormProfile, "mountain_outdoor");
});

test("currentProfile wins when patch carries empty tourType", () => {
  const base = makeBase();
  const patch: Partial<TourCreateFormValues> = {
    overview: { tourType: "" } as TourCreateFormValues["overview"],
  };
  const result = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "urban_event",
  });
  // Patch carries empty tourType → no profile re-resolve → currentProfile wins.
  assert.equal(result.resolvedFormProfile, "urban_event");
});

test("pipeline result is observably equivalent to the legacy preset-apply sequence (general profile, general preset)", () => {
  // Locks the "no observable change for the common case" promise: when a general preset
  // is applied on a general form with no theme/tourType in the patch, the new pipeline
  // must produce the same merged form as the previous filter → merge sequence.
  const base = makeBase();
  base.overview.title = "before-apply";
  const presetDefaults: Record<string, unknown> = {
    overview: { shortDescription: "from preset" },
    pricing: { basePrice: 500_000 },
    policies: { cancellationPolicy: "flex" },
  };
  const patch = presetDefaultsToFormPatch(presetDefaults);

  const legacyFiltered = filterFormPatchByActiveGroups("general", patch);
  const legacyMerged = mergeTourFormPatch(base, legacyFiltered);

  const { mergedValues, resolvedFormProfile } = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "general",
    themeCatalog,
  });
  assert.equal(resolvedFormProfile, "general");
  assert.deepEqual(mergedValues, legacyMerged);
});

test("submit-time strip parity: workspace-profile preset apply matches legacy urban strip DTO", () => {
  const base = makeBase();
  base.overview.title = "submit-parity";
  base.itinerary.days[0]!.title = "user-typed-day";
  base.participation.requirements = "user-typed-req";
  base.logistics.primaryTransportMode = "bus";
  const presetDefaults: Record<string, unknown> = {
    overview: { mainTourThemeId: THEME_URBAN, longDescription: "long" },
    itinerary: { days: [{ dayNumber: 1, segments: [{ title: "preset-day" }] }] },
    participation: { minimumAge: 30 },
    logistics: { primaryTransportMode: "plane" },
  };
  const patch = presetDefaultsToFormPatch(presetDefaults);

  const legacyFiltered = filterFormPatchByActiveGroups("general", patch);
  const legacyMerged = mergeTourFormPatch(base, legacyFiltered);
  const legacyDto = mapFormValuesToBackendPayload(
    stripInactiveTourCreateGroupsForProfile("urban_event", legacyMerged),
  );

  const { mergedValues, resolvedFormProfile } = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "urban_event",
    themeCatalog,
  });
  const wizardDto = mapFormValuesToBackendPayload(
    stripInactiveTourCreateGroupsForProfile(resolvedFormProfile, mergedValues),
  );

  assert.equal(resolvedFormProfile, "urban_event");
  assert.deepEqual(wizardDto, legacyDto);
});

test("idempotence: applying the same patch twice produces the same merged values", () => {
  const base = makeBase();
  const patch: Partial<TourCreateFormValues> = {
    overview: { title: "stable", mainTourThemeId: THEME_CINEMA } as TourCreateFormValues["overview"],
  };
  const workspaceProfile = "mountain_outdoor" as const;
  const once = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: workspaceProfile,
    themeCatalog,
  });
  const twice = applyTourWizardPatch({
    baseValues: once.mergedValues,
    patch,
    currentProfile: once.resolvedFormProfile,
    themeCatalog,
  });
  assert.deepEqual(twice.mergedValues, once.mergedValues);
  assert.equal(twice.resolvedFormProfile, once.resolvedFormProfile);
});

test("does not mutate the caller's baseValues or patch", () => {
  // Compare via a JSON round-trip on both sides so `undefined`-valued keys are
  // canonicalized the same way (the input has them, JSON.parse(JSON.stringify(...))
  // does not). The contract under test is "no observable mutation", not "key set
  // equality with the JSON-canonicalized snapshot".
  const roundTrip = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  const base = makeBase();
  const baseSnapshot = roundTrip(base);
  const patch: Partial<TourCreateFormValues> = {
    overview: { title: "x", mainTourThemeId: THEME_URBAN } as TourCreateFormValues["overview"],
    itinerary: { days: [{ dayNumber: 1, title: "should-survive-in-input", segments: [] }] } as TourCreateFormValues["itinerary"],
  };
  const patchSnapshot = roundTrip(patch);
  applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "urban_event",
    themeCatalog,
  });
  assert.deepEqual(roundTrip(base), baseSnapshot, "baseValues must remain untouched");
  assert.deepEqual(roundTrip(patch), patchSnapshot, "input patch must remain untouched");
});

test("workspace profile wins over stale snapshot meta on preload merge path", () => {
  const base = makeBase();
  base.overview.mainTourThemeId = THEME_MOUNTAIN;
  const patch: Partial<TourCreateFormValues> = {
    overview: { tourType: "mountain" } as TourCreateFormValues["overview"],
  };
  const result = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "mountain_outdoor",
    themeCatalog,
    tourType: "mountain",
    snapshot: {
      resolvedFormProfile: "cultural_tour",
      formProfileVersion: TOUR_FORM_PROFILE_VERSION,
      themeIds: { main: THEME_MOUNTAIN },
    },
  });
  assert.equal(result.resolvedFormProfile, "mountain_outdoor");
});
