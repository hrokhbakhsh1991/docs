import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";

import { applyTourWizardPatch } from "./applyTourWizardPatch";
import { mapFormValuesToBackendPayload } from "./domain/mapWizardFormToCreateTourPayload";
import {
  filterFormPatchByActiveGroups,
  sanitizeInactiveRootsForProfile,
  stripInactiveTourCreateGroupsForProfile,
} from "./fieldGroups";
import { mergeTourDraft } from "./tourCreateWizardMerge";
import { buildTourCreateFormDefaultValues } from "./tourCreateFormDefaults";
import { presetDefaultsToFormPatch } from "./tourCreationPresetMatch";
import type { ThemeRowForProfile } from "./tourWizardProfileResolve";

/**
 * Phase-1 pipeline migration: only the preset apply call site is wired to
 * `applyTourWizardPatch` (see `TourCreationPresetBanner.applySelected`).
 *
 * These tests pin the pipeline's contract — final-profile re-resolution,
 * patch filter against the FINAL profile, merge, and sanitize — so future
 * migrations (clone bootstrap, draft restore) can reuse the same seam
 * without behaviour drift.
 */

const THEME_CINEMA = "11111111-1111-4111-8111-111111111111";
const THEME_URBAN = "22222222-2222-4222-8222-222222222222";
const THEME_MOUNTAIN = "33333333-3333-4333-8333-333333333333";

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
  // mergeTourDraft returns base when patch is undefined, then sanitize against urban_event
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

test("re-resolves profile from patch.mainTourThemeId via themeCatalog (general → cinema_event)", () => {
  const base = makeBase();
  const patch: Partial<TourCreateFormValues> = {
    overview: { mainTourThemeId: THEME_CINEMA } as TourCreateFormValues["overview"],
  };
  const result = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "general",
    themeCatalog,
  });
  assert.equal(result.resolvedFormProfile, "cinema_event");
  assert.equal(result.mergedValues.overview.mainTourThemeId, THEME_CINEMA);
});

test("filters patch against the FINAL profile (general preset with itinerary applied while flipping to cinema_event drops itinerary)", () => {
  const base = makeBase();
  // Simulates a "general"-shaped preset whose mainTourThemeId points to a cinema theme.
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
    currentProfile: "general",
    themeCatalog,
  });
  assert.equal(result.resolvedFormProfile, "cinema_event");
  assert.equal(result.mergedValues.overview.title, "presets");
  assert.equal(result.mergedValues.overview.mainTourThemeId, THEME_CINEMA);
  // itinerary + participation are inactive for cinema_event → filtered out before merge,
  // and the final sanitize keeps them at canonical defaults.
  assert.deepEqual(result.mergedValues.itinerary, makeBase().itinerary);
  assert.equal(result.mergedValues.participation.requirements, "");
  // logistics is *active* for cinema_event → merged from patch.
  assert.equal(result.mergedValues.logistics.primaryTransportMode, "bus");
  assert.ok(result.filteredPatch);
  assert.ok(!("itinerary" in result.filteredPatch!));
  assert.ok(!("participation" in result.filteredPatch!));
  assert.ok("logistics" in result.filteredPatch!);
});

test("urban_event flip also drops logistics from the patch (and from the merged form)", () => {
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
    currentProfile: "general",
    themeCatalog,
  });
  assert.equal(result.resolvedFormProfile, "urban_event");
  assert.equal(result.mergedValues.overview.title, "urban-preset");
  // urban_event makes logistics inactive too → ghost from base must also be reset.
  const defaults = buildTourCreateFormDefaultValues();
  assert.deepEqual(result.mergedValues.itinerary, defaults.itinerary);
  assert.deepEqual(result.mergedValues.participation, defaults.participation);
  assert.deepEqual(result.mergedValues.logistics, defaults.logistics);
});

test("falls back to tourType when patch's mainTourThemeId is not in themeCatalog", () => {
  const base = makeBase();
  const patch: Partial<TourCreateFormValues> = {
    overview: { mainTourThemeId: "ghost-theme-not-in-catalog", tourType: "city" } as TourCreateFormValues["overview"],
  };
  const result = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "general",
    themeCatalog,
  });
  // City → urban_event per defaultTourFormProfileForTourType.
  assert.equal(result.resolvedFormProfile, "urban_event");
});

test("falls back through resolveTourFormProfile to DEFAULT when nothing resolves", () => {
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
  const legacyMerged = mergeTourDraft(base, legacyFiltered);

  const { mergedValues, resolvedFormProfile } = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "general",
    themeCatalog,
  });
  assert.equal(resolvedFormProfile, "general");
  assert.deepEqual(mergedValues, legacyMerged);
});

test("submit-time strip parity: piping the merged values through submit produces the same DTO as the legacy chain", () => {
  // Even when the new pipeline filters earlier, the canonical submit-time strip in
  // `useTourWizardCreate` must produce the same payload as before, for every profile.
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

  // Old chain: filter against general (caller's currentProfile), merge, then run submit-time strip.
  const oldFiltered = filterFormPatchByActiveGroups("general", patch);
  const oldMerged = mergeTourDraft(base, oldFiltered);
  const oldDto = mapFormValuesToBackendPayload(
    stripInactiveTourCreateGroupsForProfile("urban_event", oldMerged),
  );

  // New chain: applyTourWizardPatch → submit-time strip against the resolved profile.
  const { mergedValues, resolvedFormProfile } = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "general",
    themeCatalog,
  });
  const newDto = mapFormValuesToBackendPayload(
    stripInactiveTourCreateGroupsForProfile(resolvedFormProfile, mergedValues),
  );

  assert.equal(resolvedFormProfile, "urban_event");
  assert.deepEqual(newDto, oldDto, "final submit DTO must be identical regardless of where the inactive-group strip happens");
});

test("idempotence: applying the same patch twice produces the same merged values", () => {
  const base = makeBase();
  const patch: Partial<TourCreateFormValues> = {
    overview: { title: "stable", mainTourThemeId: THEME_CINEMA } as TourCreateFormValues["overview"],
  };
  const once = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "general",
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
    currentProfile: "general",
    themeCatalog,
  });
  assert.deepEqual(roundTrip(base), baseSnapshot, "baseValues must remain untouched");
  assert.deepEqual(roundTrip(patch), patchSnapshot, "input patch must remain untouched");
});

test("snapshot path: snapshot resolvedFormProfile wins when patch+base agree on theme", () => {
  const base = makeBase();
  base.overview.mainTourThemeId = THEME_MOUNTAIN;
  const patch: Partial<TourCreateFormValues> = {
    overview: { tourType: "mountain" } as TourCreateFormValues["overview"],
  };
  const result = applyTourWizardPatch({
    baseValues: base,
    patch,
    currentProfile: "general",
    themeCatalog,
    tourType: "mountain",
    snapshot: {
      resolvedFormProfile: "cultural_tour",
      formProfileVersion: TOUR_FORM_PROFILE_VERSION,
      themeIds: { main: THEME_MOUNTAIN },
    },
  });
  // Snapshot wins per resolveTourFormProfile contract when main themes match.
  assert.equal(result.resolvedFormProfile, "cultural_tour");
});
