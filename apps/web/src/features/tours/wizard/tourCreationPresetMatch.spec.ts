import assert from "node:assert/strict";
import test from "node:test";

import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";

import { filterFormPatchByActiveGroups } from "./fieldGroups";
import { mergeTourDraft } from "./tourCreateWizardMerge";
import { buildTourCreateFormDefaultValues } from "./tourCreateFormDefaults";
import {
  listAllTourWizardPresetsSorted,
  presetDefaultsToFormPatch,
} from "./tourCreationPresetMatch";

test("presetDefaultsToFormPatch: keeps only known wizard roots; drops unknown top-level keys", () => {
  const patch = presetDefaultsToFormPatch({
    overview: { shortDescription: "from preset" },
    participation: { minimumAge: 40 },
    unknownRoot: { foo: 1 },
    autoAcceptRegistrations: true,
  } as Record<string, unknown>);
  assert.equal(patch.autoAcceptRegistrations, true);
  assert.deepEqual(patch.overview, { shortDescription: "from preset" });
  assert.deepEqual(patch.participation, { minimumAge: 40 });
  assert.ok(!("unknownRoot" in patch));
});

test("presetDefaultsToFormPatch: ignores non-object section values", () => {
  const patch = presetDefaultsToFormPatch({
    overview: "not-an-object",
    itinerary: ["array-not-allowed"],
  } as Record<string, unknown>);
  assert.ok(!("overview" in patch));
  assert.ok(!("itinerary" in patch));
});

test("listAllTourWizardPresetsSorted: filters by resolvedFormProfile when provided", () => {
  const presets = [
    {
      id: "p-cinema",
      name: "C",
      description: null,
      isActive: true,
      sortOrder: 0,
      matchTourType: null,
      matchMainTourThemeId: null,
      formProfile: "cinema_event",
      defaults: {},
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "p-general",
      name: "G",
      description: null,
      isActive: true,
      sortOrder: 1,
      matchTourType: null,
      matchMainTourThemeId: null,
      formProfile: "general",
      defaults: {},
      createdAt: "",
      updatedAt: "",
    },
  ];
  const out = listAllTourWizardPresetsSorted(presets, "cinema_event");
  assert.equal(out.length, 1);
  assert.equal(out[0]!.id, "p-cinema");
});

test("listAllTourWizardPresetsSorted: active presets sort before inactive", () => {
  const presets = [
    {
      id: "inactive",
      name: "B",
      description: null,
      isActive: false,
      sortOrder: 0,
      matchTourType: null,
      matchMainTourThemeId: null,
      formProfile: "general",
      defaults: {},
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "active",
      name: "A",
      description: null,
      isActive: true,
      sortOrder: 0,
      matchTourType: null,
      matchMainTourThemeId: null,
      formProfile: "general",
      defaults: {},
      createdAt: "",
      updatedAt: "",
    },
  ];
  const out = listAllTourWizardPresetsSorted(presets, "general");
  assert.equal(out[0]!.id, "active");
  assert.equal(out[1]!.id, "inactive");
});

/** Preset apply filters inactive roots against workspace profile (see applyTourWizardPatch.spec). */
test("apply template path: merge after filter with cinema profile drops inactive roots from preset patch", () => {
  const base = buildTourCreateFormDefaultValues();
  const defaults: Record<string, unknown> = {
    overview: { shortDescription: "preset short" },
    itinerary: {
      days: [
        {
          dayNumber: 1,
          title: "preset day",
          description: "",
          segments: [{ title: "seg", description: "", activityType: "hike" }],
        },
      ],
    },
    participation: { minimumAge: 99 },
    logistics: { primaryTransportMode: "bus" },
  };
  const patch = presetDefaultsToFormPatch(defaults);
  const filtered = filterFormPatchByActiveGroups("cinema_event", patch);
  const merged = mergeTourDraft(base, filtered);
  assert.equal(merged.overview.shortDescription, "preset short");
  assert.deepEqual(merged.itinerary, base.itinerary);
  assert.deepEqual(merged.participation, base.participation);
  assert.equal(merged.logistics.primaryTransportMode, "bus");
});

test("apply template path: urban_event filter drops itinerary, participation, logistics from patch", () => {
  const base = buildTourCreateFormDefaultValues();
  const patch: Partial<TourCreateFormValues> = {
    overview: { title: "Street" } as TourCreateFormValues["overview"],
    itinerary: { days: [{ dayNumber: 1, title: "x", description: "", segments: [] }] } as TourCreateFormValues["itinerary"],
    participation: { minimumAge: 18 } as TourCreateFormValues["participation"],
    logistics: { primaryTransportMode: "bus" } as TourCreateFormValues["logistics"],
  };
  const filtered = filterFormPatchByActiveGroups("urban_event", patch);
  const merged = mergeTourDraft(base, filtered);
  assert.equal(merged.overview.title, "Street");
  assert.deepEqual(merged.itinerary, base.itinerary);
  assert.deepEqual(merged.participation, base.participation);
  assert.equal(merged.logistics.primaryTransportMode, base.logistics.primaryTransportMode);
});
