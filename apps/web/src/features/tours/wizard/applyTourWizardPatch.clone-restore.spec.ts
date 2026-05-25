import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/legacy/schemas/tourCreateSchema";
import { transformTourToWizardValues } from "@/features/tours/clone/transformTourToWizardValues";

import { applyTourWizardPatch } from "./applyTourWizardPatch";
import { buildTourCreateFormDefaultValues } from "./tourCreateFormDefaults";
import { parseWizardDraftRecord, serializeWizardDraft } from "./tourWizardDraftEnvelope";
import type { ThemeRowForProfile, TourWizardDraftMeta } from "./tourWizardProfileResolve";

/**
 * Clone bootstrap and draft restore call `applyTourWizardPatch` with the workspace
 * template profile as `currentProfile` (see `loadWizardPrefill`, `applyWizardDraftRestore`).
 */

const THEME_CINEMA = "11111111-1111-4111-8111-111111111111";
const THEME_URBAN = "22222222-2222-4222-8222-222222222222";
const THEME_MOUNTAIN = "33333333-3333-4333-8333-333333333333";

const themeCatalog: ThemeRowForProfile[] = [
  { id: THEME_CINEMA, formProfile: "cinema_event" },
  { id: THEME_URBAN, formProfile: "urban_event" },
  { id: THEME_MOUNTAIN, formProfile: "mountain_outdoor" },
];

test("clone: city tour with urban workspace profile drops inactive roots", () => {
  const workspaceProfile = "urban_event" as const;
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
    currentProfile: workspaceProfile,
    themeCatalog,
    tourType: wizardData.overview?.tourType,
  });

  assert.equal(resolvedFormProfile, workspaceProfile);
  assert.ok(filteredPatch, "filteredPatch must be defined for a non-empty clone");
  assert.ok(!("itinerary" in filteredPatch!), "itinerary root dropped for urban_event");
  assert.ok(!("participation" in filteredPatch!), "participation root dropped for urban_event");
  assert.ok(!("logistics" in filteredPatch!), "logistics root dropped for urban_event");
  assert.ok("overview" in filteredPatch!);
});

test("clone: cinema source with cinema workspace profile drops ghost itinerary before LS write", () => {
  const workspaceProfile = "cinema_event" as const;
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
  assert.ok((wizardData.itinerary?.days ?? []).length > 0);

  const { filteredPatch, resolvedFormProfile } = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: wizardData,
    currentProfile: workspaceProfile,
    themeCatalog,
    tourType: wizardData.overview?.tourType,
  });

  assert.equal(resolvedFormProfile, workspaceProfile);
  assert.ok(filteredPatch);
  assert.ok(!("itinerary" in filteredPatch!), "ghost itinerary stripped at the apply boundary");
  assert.ok(!("participation" in filteredPatch!), "ghost participation stripped at the apply boundary");
});

test("clone: unknown theme with mountain workspace profile keeps mountain-active roots", () => {
  const workspaceProfile = "mountain_outdoor" as const;
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
    currentProfile: workspaceProfile,
    themeCatalog,
    tourType: wizardData.overview?.tourType,
  });
  assert.equal(resolvedFormProfile, workspaceProfile);
  assert.ok(filteredPatch);
  assert.ok("itinerary" in filteredPatch!);
});

test("clone → envelope round-trip → restore: workspace profile stays stable", () => {
  const workspaceProfile = "cinema_event" as const;
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
    currentProfile: workspaceProfile,
    themeCatalog,
    tourType: wizardData.overview?.tourType,
  });
  assert.equal(cloneResult.resolvedFormProfile, workspaceProfile);

  const wizardMeta: TourWizardDraftMeta = {
    sourceTourId: "src-1",
    themeIds: { main: THEME_CINEMA },
    resolvedFormProfile: workspaceProfile,
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
  };
  const envelope = serializeWizardDraft(
    cloneResult.filteredPatch as Partial<TourCreateFormValues>,
    wizardMeta,
  );
  assert.ok(!envelope.includes("ghost-itinerary"), "envelope free of ghost itinerary");
  assert.ok(!envelope.includes("ghost-seg"), "envelope free of ghost segment");
  assert.ok(!envelope.includes("ghost-participation"), "envelope free of ghost participation");
  assert.ok(envelope.includes("_wizardMeta"));

  const parsed = parseWizardDraftRecord(envelope);
  assert.ok(parsed);
  const restoreResult = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: parsed!.formPatch,
    currentProfile: parsed!.wizardMeta!.resolvedFormProfile,
    themeCatalog: undefined,
    tourType: parsed!.formPatch.overview?.tourType,
    snapshot: parsed!.wizardMeta,
  });

  assert.equal(restoreResult.resolvedFormProfile, workspaceProfile);
  const defaults = buildTourCreateFormDefaultValues();
  assert.deepEqual(restoreResult.mergedValues.itinerary, { days: [] });
  assert.deepEqual(restoreResult.mergedValues.participation, defaults.participation);
  assert.equal(restoreResult.mergedValues.overview.mainTourThemeId, THEME_CINEMA);
});

test("restore: legacy envelope without _wizardMeta uses explicit workspace currentProfile", () => {
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
    currentProfile: "urban_event",
    themeCatalog: undefined,
    tourType: parsed!.formPatch.overview?.tourType,
    snapshot: undefined,
  });
  assert.equal(result.resolvedFormProfile, "urban_event");
  const defaults = buildTourCreateFormDefaultValues();
  assert.deepEqual(result.mergedValues.itinerary, { days: [] });
  assert.deepEqual(result.mergedValues.participation, defaults.participation);
  assert.deepEqual(result.mergedValues.logistics, defaults.logistics);
});

test("restore: snapshot profile is preserved when currentProfile matches workspace meta", () => {
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

test("restore: theme flip in patch does not override workspace profile from meta", () => {
  const workspaceProfile = "mountain_outdoor" as const;
  const envelope = serializeWizardDraft(
    {
      overview: { title: "flipped", mainTourThemeId: THEME_CINEMA } as TourCreateFormValues["overview"],
    },
    {
      resolvedFormProfile: workspaceProfile,
      formProfileVersion: TOUR_FORM_PROFILE_VERSION,
      themeIds: { main: THEME_MOUNTAIN },
    },
  );
  const parsed = parseWizardDraftRecord(envelope);
  assert.ok(parsed);

  const withCatalog = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: parsed!.formPatch,
    currentProfile: parsed!.wizardMeta!.resolvedFormProfile,
    themeCatalog,
    tourType: parsed!.formPatch.overview?.tourType,
    snapshot: parsed!.wizardMeta,
  });
  assert.equal(withCatalog.resolvedFormProfile, workspaceProfile);

  const withoutCatalog = applyTourWizardPatch({
    baseValues: buildTourCreateFormDefaultValues(),
    patch: parsed!.formPatch,
    currentProfile: parsed!.wizardMeta!.resolvedFormProfile,
    themeCatalog: undefined,
    tourType: parsed!.formPatch.overview?.tourType,
    snapshot: parsed!.wizardMeta,
  });
  assert.equal(withoutCatalog.resolvedFormProfile, workspaceProfile);
});

test("restore: undefined patch preserves currentProfile", () => {
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
  const defaults = buildTourCreateFormDefaultValues();
  assert.deepEqual(result.mergedValues.itinerary, { days: [] });
  assert.deepEqual(result.mergedValues.participation, defaults.participation);
});
