import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import { transformTourToWizardValues } from "@/features/tours/clone/transformTourToWizardValues";

import { applyTourWizardPatch } from "./applyTourWizardPatch";
import { buildTourCreateFormDefaultValues } from "./tourCreateFormDefaults";
import { parseWizardDraftRecord, serializeWizardDraft } from "./tourWizardDraftEnvelope";
import type { ThemeRowForProfile, TourWizardDraftMeta } from "./tourWizardProfileResolve";

/**
 * Phase-2 pipeline migration: clone bootstrap (`tour-create-wizard-wrapper.tsx`)
 * and draft restore (`TourCreateWizard.tsx` `useLayoutEffect`) now both call
 * `applyTourWizardPatch`. These tests pin the pipeline's behaviour against
 * realistic inputs from those two call sites so future refactors of either
 * call site stay symmetric with the canonical submit-time strip.
 */

const THEME_CINEMA = "11111111-1111-4111-8111-111111111111";
const THEME_URBAN = "22222222-2222-4222-8222-222222222222";
const THEME_MOUNTAIN = "33333333-3333-4333-8333-333333333333";

const themeCatalog: ThemeRowForProfile[] = [
  { id: THEME_CINEMA, formProfile: "cinema_event" },
  { id: THEME_URBAN, formProfile: "urban_event" },
  { id: THEME_MOUNTAIN, formProfile: "mountain_outdoor" },
];

/* -------------------------------------------------------------------------- *
 * Clone-bootstrap scenarios
 *
 * Mirror what `tour-create-wizard-wrapper.tsx` does:
 *   1. `transformTourToWizardValues(apiTour)` → a `Partial<TourCreateFormValues>`.
 *   2. `applyTourWizardPatch({ baseValues: defaults, patch, currentProfile: "general",
 *      themeCatalog, tourType })`.
 *   3. Serialize `filteredPatch` into the wizard draft envelope (with `_wizardMeta`).
 *   4. Restore is the inverse via `parseWizardDraftRecord` + the same pipeline call.
 * -------------------------------------------------------------------------- */

test("clone: city tour with empty trip details → urban_event profile, envelope free of ghost roots", () => {
  const apiTour = {
    title: "city tour clone",
    tourType: "city",
    details: {
      tripDetails: {
        overview: {
          shortIntro: "intro",
          mainTourThemeId: "",
          tourThemeIds: [],
        },
        itinerary: { days: [] },
        participation: {},
        logistics: {},
        policies: {},
      },
    },
    costContext: { basePriceToman: 0 },
  };
  const wizardData = transformTourToWizardValues(apiTour);

  const { filteredPatch, resolvedFormProfile } = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: wizardData,
    currentProfile: "general",
    themeCatalog,
    tourType: wizardData.overview?.tourType,
  });

  // city → urban_event per defaultTourFormProfileForTourType (no theme override).
  assert.equal(resolvedFormProfile, "urban_event");
  assert.ok(filteredPatch, "filteredPatch must be defined for a non-empty clone");
  // urban_event makes itinerary / participation / logistics inactive — they must NOT survive
  // the filter step, regardless of whether the source tour had data in them.
  assert.ok(!("itinerary" in filteredPatch!), "itinerary root dropped for urban_event");
  assert.ok(!("participation" in filteredPatch!), "participation root dropped for urban_event");
  assert.ok(!("logistics" in filteredPatch!), "logistics root dropped for urban_event");
  // Active roots survive the filter.
  assert.ok("overview" in filteredPatch!);
});

test("clone: tour with cinema theme in catalog → cinema_event profile, ghost itinerary dropped before LS write", () => {
  // Simulates a mountain-source tour whose mainTourThemeId points to a workspace
  // cinema_event theme (e.g. user reused a cinema brand on a hike). Pre-pipeline the
  // unfiltered itinerary would have been persisted on disk.
  const apiTour = {
    title: "ghost-itinerary clone",
    tourType: "mountain",
    details: {
      tripDetails: {
        overview: {
          shortIntro: "intro",
          mainTourThemeId: THEME_CINEMA,
          tourThemeIds: [THEME_CINEMA],
        },
        itinerary: {
          segmentActivities: [
            {
              dayNumber: 1,
              title: "must-not-persist",
              segments: [{ title: "must-not-persist-seg", activityType: "hike" }],
            },
          ],
        },
        participation: { minimumAge: 18, requirements: "must-not-persist-req" },
        logistics: {},
        policies: {},
      },
    },
    costContext: { basePriceToman: 0 },
  };
  const wizardData = transformTourToWizardValues(apiTour);
  // Sanity: the transform DID carry itinerary days from the source.
  assert.ok((wizardData.itinerary?.days ?? []).length > 0);

  const { filteredPatch, resolvedFormProfile } = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: wizardData,
    currentProfile: "general",
    themeCatalog,
    tourType: wizardData.overview?.tourType,
  });

  assert.equal(resolvedFormProfile, "cinema_event", "theme catalog wins over tourType (mountain)");
  assert.ok(filteredPatch);
  assert.ok(!("itinerary" in filteredPatch!), "ghost itinerary stripped at the apply boundary");
  assert.ok(!("participation" in filteredPatch!), "ghost participation stripped at the apply boundary");
  // logistics is active for cinema_event → it survives if present in the patch.
  // (Not asserting here because the source had `logistics: {}` which becomes a wizard-shaped patch
  //  key only if non-empty; we just care the strip didn't drop it accidentally.)
});

test("clone: theme id not in catalog → falls back to tourType (mountain → mountain_outdoor), no roots dropped", () => {
  const apiTour = {
    title: "fallback clone",
    tourType: "mountain",
    details: {
      tripDetails: {
        overview: {
          shortIntro: "intro",
          mainTourThemeId: "unknown-theme-not-in-catalog",
          tourThemeIds: [],
        },
        itinerary: {
          segmentActivities: [{ dayNumber: 1, title: "Day 1", segments: [] }],
        },
        participation: {},
        logistics: {},
        policies: {},
      },
    },
    costContext: { basePriceToman: 0 },
  };
  const wizardData = transformTourToWizardValues(apiTour);
  const { filteredPatch, resolvedFormProfile } = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: wizardData,
    currentProfile: "general",
    themeCatalog,
    tourType: wizardData.overview?.tourType,
  });
  assert.equal(resolvedFormProfile, "mountain_outdoor", "fallback to tourType when theme missing from catalog");
  assert.ok(filteredPatch);
  // mountain_outdoor has no inactive groups → itinerary, participation, logistics survive.
  assert.ok("itinerary" in filteredPatch!);
});

test("clone → envelope round-trip → restore: pipeline output is stable and ghost-free", () => {
  // 1. CLONE: build envelope from a source whose theme resolves to cinema_event.
  const apiTour = {
    title: "round-trip clone",
    tourType: "mountain",
    details: {
      tripDetails: {
        overview: {
          shortIntro: "intro",
          mainTourThemeId: THEME_CINEMA,
          tourThemeIds: [THEME_CINEMA],
        },
        itinerary: {
          segmentActivities: [
            { dayNumber: 1, title: "ghost-itinerary", segments: [{ title: "ghost-seg" }] },
          ],
        },
        participation: { requirements: "ghost-participation" },
        logistics: {},
        policies: {},
      },
    },
    costContext: { basePriceToman: 0 },
  };
  const wizardData = transformTourToWizardValues(apiTour);
  const cloneResult = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: wizardData,
    currentProfile: "general",
    themeCatalog,
    tourType: wizardData.overview?.tourType,
  });
  assert.equal(cloneResult.resolvedFormProfile, "cinema_event");

  const wizardMeta: TourWizardDraftMeta = {
    sourceTourId: "src-1",
    themeIds: { main: THEME_CINEMA },
    resolvedFormProfile: cloneResult.resolvedFormProfile,
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
  };
  const envelope = serializeWizardDraft(
    cloneResult.filteredPatch as Partial<TourCreateFormValues>,
    wizardMeta,
  );
  // The serialized envelope must not contain any ghost values.
  assert.ok(!envelope.includes("ghost-itinerary"), "envelope free of ghost itinerary");
  assert.ok(!envelope.includes("ghost-seg"), "envelope free of ghost segment");
  assert.ok(!envelope.includes("ghost-participation"), "envelope free of ghost participation");
  assert.ok(envelope.includes("_wizardMeta"));

  // 2. RESTORE: feed the envelope back through the pipeline (mirroring `useLayoutEffect` restore).
  const parsed = parseWizardDraftRecord(envelope);
  assert.ok(parsed);
  const restoreResult = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: parsed!.formPatch,
    currentProfile: parsed!.wizardMeta!.resolvedFormProfile,
    // `themesQuery.data` is unavailable at `useLayoutEffect` time — the pipeline must still
    // resolve correctly via snapshot priority for matched themes.
    themeCatalog: undefined,
    tourType: parsed!.formPatch.overview?.tourType,
    snapshot: parsed!.wizardMeta,
  });

  // Snapshot priority kicks in (same `mainTourThemeId` in patch + snapshot) → profile is stable.
  assert.equal(restoreResult.resolvedFormProfile, "cinema_event", "snapshot wins on matched theme");
  // Restored form has canonical defaults for inactive roots and active-root data from clone.
  const defaults = buildTourCreateFormDefaultValues();
  assert.deepEqual(restoreResult.mergedValues.itinerary, defaults.itinerary);
  assert.deepEqual(restoreResult.mergedValues.participation, defaults.participation);
  assert.equal(restoreResult.mergedValues.overview.mainTourThemeId, THEME_CINEMA);
});

/* -------------------------------------------------------------------------- *
 * Restore-only scenarios (autosave-written envelopes; no snapshot or partial snapshot).
 * -------------------------------------------------------------------------- */

test("restore: legacy envelope without `_wizardMeta` falls back to tourType (city → urban_event)", () => {
  // Mirrors an old auto-save written before `_wizardMeta` was introduced.
  const legacyEnvelope = JSON.stringify({
    overview: { title: "legacy", tourType: "city" },
    itinerary: {
      days: [{ dayNumber: 1, title: "legacy-day", segments: [{ title: "legacy-seg", activityType: "hike" }] }],
    },
    participation: { minimumAge: 18 },
  });
  const parsed = parseWizardDraftRecord(legacyEnvelope);
  assert.ok(parsed);
  assert.equal(parsed!.wizardMeta, undefined);

  const result = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: parsed!.formPatch,
    currentProfile: "urban_event", // what the restore effect computes via defaultTourFormProfileForTourType(city)
    themeCatalog: undefined,
    tourType: parsed!.formPatch.overview?.tourType,
    snapshot: undefined,
  });
  // Patch carries `tourType: "city"` → pipeline re-resolves → urban_event.
  assert.equal(result.resolvedFormProfile, "urban_event");
  // Inactive roots reset on the merged form.
  const defaults = buildTourCreateFormDefaultValues();
  assert.deepEqual(result.mergedValues.itinerary, defaults.itinerary);
  assert.deepEqual(result.mergedValues.participation, defaults.participation);
  assert.deepEqual(result.mergedValues.logistics, defaults.logistics);
});

test("restore: snapshot's resolvedFormProfile wins when themes still match (no theme change in session)", () => {
  const envelope = serializeWizardDraft(
    {
      overview: { title: "stable", mainTourThemeId: THEME_MOUNTAIN, tourType: "mountain" } as TourCreateFormValues["overview"],
    },
    {
      resolvedFormProfile: "mountain_outdoor",
      formProfileVersion: TOUR_FORM_PROFILE_VERSION,
      themeIds: { main: THEME_MOUNTAIN },
    },
  );
  const parsed = parseWizardDraftRecord(envelope);
  assert.ok(parsed);

  const result = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: parsed!.formPatch,
    currentProfile: parsed!.wizardMeta!.resolvedFormProfile,
    themeCatalog: undefined,
    tourType: parsed!.formPatch.overview?.tourType,
    snapshot: parsed!.wizardMeta,
  });
  assert.equal(result.resolvedFormProfile, "mountain_outdoor");
  assert.equal(result.mergedValues.overview.title, "stable");
});

test("restore: snapshot profile is replaced when patch's mainTourThemeId differs and is in catalog", () => {
  // Catches the "user flipped theme then reloaded" case: snapshot says mountain_outdoor
  // but the patch's mainTourThemeId now points to a cinema theme. With themeCatalog
  // available, the pipeline picks cinema_event; without it, snapshot priority does NOT
  // apply because `snapMain !== mainId`, so we fall back through tourType / default.
  const envelope = serializeWizardDraft(
    {
      overview: { title: "flipped", mainTourThemeId: THEME_CINEMA } as TourCreateFormValues["overview"],
    },
    {
      resolvedFormProfile: "mountain_outdoor",
      formProfileVersion: TOUR_FORM_PROFILE_VERSION,
      themeIds: { main: THEME_MOUNTAIN }, // stale: pre-flip
    },
  );
  const parsed = parseWizardDraftRecord(envelope);
  assert.ok(parsed);

  // With themeCatalog (e.g. later re-derive via `useWatch`): cinema_event.
  const withCatalog = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: parsed!.formPatch,
    currentProfile: parsed!.wizardMeta!.resolvedFormProfile,
    themeCatalog,
    tourType: parsed!.formPatch.overview?.tourType,
    snapshot: parsed!.wizardMeta,
  });
  assert.equal(withCatalog.resolvedFormProfile, "cinema_event");

  // Without themeCatalog (initial useLayoutEffect): snapshot is ignored (themes mismatch)
  // and there's no tourType in the patch → DEFAULT_TOUR_FORM_PROFILE ("general"). The
  // auto-save sanitize hook will re-resolve & re-write a clean envelope on the next tick
  // once `themesQuery.data` lands.
  const withoutCatalog = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: parsed!.formPatch,
    currentProfile: parsed!.wizardMeta!.resolvedFormProfile,
    themeCatalog: undefined,
    tourType: parsed!.formPatch.overview?.tourType,
    snapshot: parsed!.wizardMeta,
  });
  assert.equal(withoutCatalog.resolvedFormProfile, "general");
});

test("restore: undefined patch (rare edge — empty envelope) preserves snapshot profile", () => {
  const result = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: undefined,
    currentProfile: "cinema_event",
    themeCatalog,
    snapshot: {
      resolvedFormProfile: "cinema_event",
      formProfileVersion: TOUR_FORM_PROFILE_VERSION,
    },
  });
  assert.equal(result.resolvedFormProfile, "cinema_event");
  assert.equal(result.filteredPatch, undefined);
  // Merged form has inactive roots reset to defaults (sanitize stage).
  const defaults = buildTourCreateFormDefaultValues();
  assert.deepEqual(result.mergedValues.itinerary, defaults.itinerary);
  assert.deepEqual(result.mergedValues.participation, defaults.participation);
});
