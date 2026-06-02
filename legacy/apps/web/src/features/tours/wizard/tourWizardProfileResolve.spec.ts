import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VALUES, TOUR_FORM_PROFILE_VERSION } from "@repo/types";

import {
  coalesceWizardMainTourThemeId,
  coalesceWizardResolvedProfile,
  preserveWizardMetaResolvedProfile,
  resolveTourFormProfile,
  resolveTourFormProfileForTourFormValues,
  type TourWizardPrefillMeta,
} from "./tourWizardProfileResolve";
import { getVisibleWizardStepsForProfile } from "./tourWizardStepPlan";

test("getVisibleWizardStepsForProfile: general keeps itinerary and participation", () => {
  const steps = getVisibleWizardStepsForProfile("general");
  assert.ok(steps.includes("itinerary"));
  assert.ok(steps.includes("participation"));
  assert.ok(steps.includes("logistics"));
});

test("getVisibleWizardStepsForProfile: theme step immediately follows basic for every profile", () => {
  for (const p of TOUR_FORM_PROFILE_VALUES) {
    const steps = getVisibleWizardStepsForProfile(p);
    const iBasic = steps.indexOf("basic");
    const iTheme = steps.indexOf("theme");
    assert.ok(iBasic >= 0 && iTheme >= 0, `missing basic/theme for ${p}`);
    assert.equal(iTheme, iBasic + 1, `theme should follow basic for profile ${p}`);
  }
});

test("getVisibleWizardStepsForProfile: cinema_event drops itinerary and participation", () => {
  const steps = getVisibleWizardStepsForProfile("cinema_event");
  assert.ok(!steps.includes("itinerary"));
  assert.ok(!steps.includes("participation"));
  assert.ok(steps.includes("logistics"));
});

test("getVisibleWizardStepsForProfile: urban_event also drops logistics", () => {
  const steps = getVisibleWizardStepsForProfile("urban_event");
  assert.ok(!steps.includes("itinerary"));
  assert.ok(!steps.includes("participation"));
  assert.ok(!steps.includes("logistics"));
});

test("resolveTourFormProfile: uses snapshot when main theme matches", () => {
  const snapshot: TourWizardPrefillMeta = {
    resolvedFormProfile: "cinema_event",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
    themeIds: { main: "theme-a" },
  };
  const r = resolveTourFormProfile({
    snapshot,
    mainTourThemeId: "theme-a",
    themeCatalog: [{ id: "theme-a", formProfile: "general" }],
    tourType: "mountain",
  });
  assert.equal(r, "cinema_event");
});

test("resolveTourFormProfile: ignores snapshot when user changed main theme", () => {
  const snapshot: TourWizardPrefillMeta = {
    resolvedFormProfile: "cinema_event",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
    themeIds: { main: "theme-a" },
  };
  const r = resolveTourFormProfile({
    snapshot,
    mainTourThemeId: "theme-b",
    themeCatalog: [
      { id: "theme-a", formProfile: "cinema_event" },
      { id: "theme-b", formProfile: "mountain_outdoor" },
    ],
    tourType: "city",
  });
  assert.equal(r, "mountain_outdoor");
});

test("coalesceWizardMainTourThemeId prefers RHF then storage then DOM", () => {
  assert.equal(
    coalesceWizardMainTourThemeId({
      watchedMain: "theme-rhf",
      storageMain: "theme-storage",
      domMain: "theme-dom",
    }),
    "theme-rhf",
  );
  assert.equal(
    coalesceWizardMainTourThemeId({
      watchedMain: "",
      storageMain: "theme-storage",
      domMain: "theme-dom",
    }),
    "theme-storage",
  );
});

test("resolveTourFormProfile: storage-bound main theme id resolves via catalog before snapshot general", () => {
  const r = resolveTourFormProfile({
    snapshot: {
      resolvedFormProfile: "general",
      formProfileVersion: TOUR_FORM_PROFILE_VERSION,
    },
    mainTourThemeId: "theme-mountain",
    themeCatalog: [{ id: "theme-mountain", formProfile: "mountain_outdoor" }],
    tourType: "mountain",
  });
  assert.equal(r, "mountain_outdoor");
});

test("resolveTourFormProfile: theme catalog wins without snapshot", () => {
  const r = resolveTourFormProfile({
    mainTourThemeId: "t1",
    themeCatalog: [{ id: "t1", formProfile: "nature_trip" }],
    tourType: undefined,
  });
  assert.equal(r, "nature_trip");
});

test("resolveTourFormProfile: tourType fallback when no theme match", () => {
  const r = resolveTourFormProfile({
    mainTourThemeId: "",
    themeCatalog: [],
    tourType: "mountain",
  });
  assert.equal(r, "mountain_outdoor");
});

test("resolveTourFormProfile: general snapshot yields to explicit non-general tourType", () => {
  const snapshot: TourWizardPrefillMeta = {
    resolvedFormProfile: "general",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
    themeIds: { main: "theme-a" },
  };
  const r = resolveTourFormProfile({
    snapshot,
    mainTourThemeId: "theme-a",
    themeCatalog: [{ id: "theme-a", formProfile: "general" }],
    tourType: "city",
  });
  assert.equal(r, "urban_event");
});

test("resolveTourFormProfile: snapshot theme id without live main binding yields to tourType", () => {
  const snapshot: TourWizardPrefillMeta = {
    resolvedFormProfile: "general",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
    themeIds: { main: "theme-a" },
  };
  const r = resolveTourFormProfile({
    snapshot,
    mainTourThemeId: undefined,
    themeCatalog: [{ id: "theme-a", formProfile: "cinema_event" }],
    tourType: "city",
  });
  assert.equal(r, "urban_event");
});

test("resolveTourFormProfile: stale non-general snapshot without theme binding yields to tourType", () => {
  const snapshot: TourWizardPrefillMeta = {
    resolvedFormProfile: "mountain_outdoor",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
  };
  const r = resolveTourFormProfile({
    snapshot,
    mainTourThemeId: undefined,
    themeCatalog: [],
    tourType: "city",
  });
  assert.equal(r, "urban_event");
});

test("resolveTourFormProfile: general snapshot without theme binding yields to tourType", () => {
  const snapshot: TourWizardPrefillMeta = {
    resolvedFormProfile: "general",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
  };
  const r = resolveTourFormProfile({
    snapshot,
    mainTourThemeId: undefined,
    themeCatalog: [],
    tourType: "city",
  });
  assert.equal(r, "urban_event");
});

test("resolveTourFormProfileForTourFormValues: matches theme row (no snapshot)", () => {
  const r = resolveTourFormProfileForTourFormValues({
    mainTourThemeId: "t1",
    themeCatalog: [{ id: "t1", formProfile: "cinema_event" }],
    tourType: "mountain",
  });
  assert.equal(r, "cinema_event");
});

test("resolveTourFormProfileForTourFormValues: tourType fallback", () => {
  const r = resolveTourFormProfileForTourFormValues({
    mainTourThemeId: undefined,
    themeCatalog: [],
    tourType: "city",
  });
  assert.equal(r, "urban_event");
});

/** S1 — all resolve inputs empty → DEFAULT_TOUR_FORM_PROFILE ("general"). */
test("resolveTourFormProfile: empty main, empty catalog, no tourType → general", () => {
  assert.equal(
    resolveTourFormProfile({
      snapshot: undefined,
      mainTourThemeId: undefined,
      themeCatalog: [],
      tourType: undefined,
    }),
    "general",
  );
});

/** S5 — main id set but not in catalog → tourType fallback (not snapshot). */
test("resolveTourFormProfile: missing theme id in catalog falls back to tourType", () => {
  assert.equal(
    resolveTourFormProfile({
      mainTourThemeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      themeCatalog: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", formProfile: "cinema_event" }],
      tourType: "cultural",
    }),
    "cultural_tour",
  );
});

/** S11b — simulate profile change after user would pick a new main theme (second resolve call). */
test("resolveTourFormProfile: sequential theme change general → urban_event via catalog", () => {
  const catalog = [
    { id: "theme-general", formProfile: "general" as const },
    { id: "theme-urban", formProfile: "urban_event" as const },
  ];
  const first = resolveTourFormProfile({
    mainTourThemeId: "theme-general",
    themeCatalog: catalog,
    tourType: "city",
  });
  assert.equal(first, "general");
  const second = resolveTourFormProfile({
    mainTourThemeId: "theme-urban",
    themeCatalog: catalog,
    tourType: "city",
  });
  assert.equal(second, "urban_event");
});

test("resolveTourFormProfile: theme row with null formProfile falls through to tourType", () => {
  assert.equal(
    resolveTourFormProfile({
      mainTourThemeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      themeCatalog: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", formProfile: null }],
      tourType: "nature",
    }),
    "nature_trip",
  );
});

test("preserveWizardMetaResolvedProfile: does not downgrade mountain_outdoor to general", () => {
  assert.equal(
    preserveWizardMetaResolvedProfile("general", "mountain_outdoor"),
    "mountain_outdoor",
  );
  assert.equal(preserveWizardMetaResolvedProfile("urban_event", "mountain_outdoor"), "urban_event");
  assert.equal(preserveWizardMetaResolvedProfile("general", "general"), "general");
  assert.equal(preserveWizardMetaResolvedProfile("general", undefined), "general");
});

test("coalesceWizardResolvedProfile: main theme catalog wins over transient general", () => {
  assert.equal(
    coalesceWizardResolvedProfile({
      raw: "general",
      mainTourThemeId: "theme-1",
      themeCatalog: [{ id: "theme-1", formProfile: "mountain_outdoor" }],
    }),
    "mountain_outdoor",
  );
});

test("resolveTourFormProfile: bound main theme catalog wins over general snapshot label", () => {
  const snapshot: TourWizardPrefillMeta = {
    resolvedFormProfile: "general",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
    themeIds: { main: "theme-1" },
  };
  assert.equal(
    resolveTourFormProfile({
      snapshot,
      mainTourThemeId: "theme-1",
      themeCatalog: [{ id: "theme-1", formProfile: "mountain_outdoor" }],
      tourType: "mountain",
    }),
    "mountain_outdoor",
  );
});

test("wizard derived profile: preserve snapshot then tourType when resolve returns general", () => {
  const snapshot: TourWizardPrefillMeta = {
    resolvedFormProfile: "mountain_outdoor",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
  };
  const raw = resolveTourFormProfile({
    snapshot: undefined,
    mainTourThemeId: undefined,
    themeCatalog: [],
    tourType: undefined,
    ignoreSnapshot: false,
  });
  assert.equal(raw, "general");
  const preserved = preserveWizardMetaResolvedProfile(raw, snapshot.resolvedFormProfile);
  assert.equal(preserved, "mountain_outdoor");
});
