import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VALUES } from "@repo/types";

import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";

import {
  filterFormPatchByActiveGroups,
  inactiveTourCreateRootKeysForProfile,
} from "./fieldGroups";
import { mergeTourDraft } from "./tourCreateWizardMerge";
import { buildTourCreateFormDefaultValues } from "./tourCreateFormDefaults";
import { presetDefaultsToFormPatch } from "./tourCreationPresetMatch";

/**
 * Spec covers the **profile-aware preload filter** (`filterFormPatchByActiveGroups`) and its
 * integration with `mergeTourDraft` used by both presets and clone/draft restore.
 *
 * Contract: roots owned by **inactive** field groups for the resolved profile must not be
 * merged into RHF state. Active-group roots must round-trip untouched.
 */

test("filterFormPatchByActiveGroups: undefined patch returns undefined", () => {
  assert.equal(filterFormPatchByActiveGroups("cinema_event", undefined), undefined);
});

test("filterFormPatchByActiveGroups: profiles with no inactive groups return the patch by reference", () => {
  const patch: Partial<TourCreateFormValues> = {
    overview: { title: "x" } as TourCreateFormValues["overview"],
    participation: { minimumAge: 18 } as TourCreateFormValues["participation"],
  };
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    if (inactiveTourCreateRootKeysForProfile(profile).length !== 0) continue;
    const out = filterFormPatchByActiveGroups(profile, patch);
    assert.equal(out, patch, `expected same reference for "${profile}"`);
  }
});

test("filterFormPatchByActiveGroups: cinema_event drops itinerary + participation roots", () => {
  const patch: Partial<TourCreateFormValues> = {
    overview: { title: "x" } as TourCreateFormValues["overview"],
    itinerary: { days: [{ dayNumber: 1, segments: [] }] } as TourCreateFormValues["itinerary"],
    participation: { minimumAge: 18 } as TourCreateFormValues["participation"],
    logistics: { primaryTransportMode: "bus" } as TourCreateFormValues["logistics"],
  };
  const out = filterFormPatchByActiveGroups("cinema_event", patch);
  assert.ok(out, "filtered patch should not be undefined");
  assert.ok(!("itinerary" in (out as object)), "itinerary should be dropped");
  assert.ok(!("participation" in (out as object)), "participation should be dropped");
  assert.deepEqual((out as Partial<TourCreateFormValues>).overview, { title: "x" });
  assert.deepEqual(
    (out as Partial<TourCreateFormValues>).logistics,
    { primaryTransportMode: "bus" },
    "logistics remains active for cinema_event",
  );
});

test("filterFormPatchByActiveGroups: urban_event additionally drops logistics", () => {
  const patch: Partial<TourCreateFormValues> = {
    overview: { title: "x" } as TourCreateFormValues["overview"],
    itinerary: { days: [] } as TourCreateFormValues["itinerary"],
    participation: { minimumAge: 18 } as TourCreateFormValues["participation"],
    logistics: { primaryTransportMode: "bus" } as TourCreateFormValues["logistics"],
  };
  const out = filterFormPatchByActiveGroups("urban_event", patch);
  assert.ok(out);
  assert.ok(!("itinerary" in (out as object)));
  assert.ok(!("participation" in (out as object)));
  assert.ok(!("logistics" in (out as object)));
  assert.deepEqual((out as Partial<TourCreateFormValues>).overview, { title: "x" });
});

test("filterFormPatchByActiveGroups: returns a fresh shallow copy (does not mutate caller's patch)", () => {
  const patch: Partial<TourCreateFormValues> = {
    overview: { title: "x" } as TourCreateFormValues["overview"],
    itinerary: { days: [] } as TourCreateFormValues["itinerary"],
  };
  const out = filterFormPatchByActiveGroups("cinema_event", patch);
  assert.notEqual(out, patch, "filtered result must be a fresh object reference");
  assert.ok("itinerary" in patch, "input patch must remain untouched");
});

test("integration with mergeTourDraft: cinema_event preset cannot write participation / itinerary", () => {
  const base = buildTourCreateFormDefaultValues();
  const presetDefaults: Record<string, unknown> = {
    overview: { title: "Movie Night" },
    participation: { minimumAge: 30 },
    itinerary: { days: [{ dayNumber: 1, segments: [{ title: "x" }] }] },
    logistics: { primaryTransportMode: "bus" },
  };
  const patch = presetDefaultsToFormPatch(presetDefaults);
  const filtered = filterFormPatchByActiveGroups("cinema_event", patch);
  const merged = mergeTourDraft(base, filtered);

  assert.equal(merged.overview.title, "Movie Night", "active root (overview) is merged");
  assert.deepEqual(
    merged.participation,
    base.participation,
    "participation stays at canonical defaults (inactive for cinema_event)",
  );
  assert.deepEqual(
    merged.itinerary,
    base.itinerary,
    "itinerary stays at canonical defaults (inactive for cinema_event)",
  );
  assert.equal(
    merged.logistics.primaryTransportMode,
    "bus",
    "logistics still merges (active for cinema_event)",
  );
});

test("integration with mergeTourDraft: urban_event clone cannot preload logistics", () => {
  const base = buildTourCreateFormDefaultValues();
  // Simulates the shape produced by `transformTourToWizardValues` for a non-urban source tour.
  const clonePatch: Partial<TourCreateFormValues> = {
    overview: { title: "Street Fair" } as TourCreateFormValues["overview"],
    logistics: {
      primaryTransportMode: "bus",
      fuelShareToman: 300_000,
    } as TourCreateFormValues["logistics"],
    participation: {
      minimumAge: 18,
      gearRequiredIds: ["abc"],
    } as TourCreateFormValues["participation"],
  };
  const filtered = filterFormPatchByActiveGroups("urban_event", clonePatch);
  const merged = mergeTourDraft(base, filtered);

  assert.equal(merged.overview.title, "Street Fair");
  // Assert per-field rather than full shape: `mergeTourDraft` always normalizes
  // `logistics.accommodationTypes` via `sanitizeWizardAccommodationTypes`, which is unrelated to
  // this filter. The contract we care about is that nothing the patch carried in logistics /
  // participation leaks into the merged form.
  assert.equal(
    merged.logistics.primaryTransportMode,
    base.logistics.primaryTransportMode,
    "primaryTransportMode stays at canonical defaults for urban_event",
  );
  assert.equal(
    merged.logistics.fuelShareToman,
    base.logistics.fuelShareToman,
    "fuelShareToman stays at canonical defaults for urban_event",
  );
  assert.equal(
    merged.participation.minimumAge,
    base.participation.minimumAge,
    "participation.minimumAge stays at canonical defaults for urban_event",
  );
  assert.deepEqual(
    merged.participation.gearRequiredIds,
    base.participation.gearRequiredIds,
    "participation.gearRequiredIds stays at canonical defaults for urban_event",
  );
});

test("integration with mergeTourDraft: cinema_event clone cannot preload itinerary / participation", () => {
  const base = buildTourCreateFormDefaultValues();
  // Simulates a clone where the source tour was a mountain trip (active itinerary +
  // participation lists) being restored into a cinema_event wizard.
  const clonePatch: Partial<TourCreateFormValues> = {
    overview: { title: "Cloned Trip" } as TourCreateFormValues["overview"],
    itinerary: {
      days: [
        { dayNumber: 1, title: "Approach", description: "", segments: [{ title: "drive", activityType: "transfer" }] },
        { dayNumber: 2, title: "Summit", description: "", segments: [{ title: "climb", activityType: "summit" }] },
      ],
    } as TourCreateFormValues["itinerary"],
    participation: {
      minimumAge: 22,
      maximumAge: 60,
      skillsRequired: ["alpine"],
      gearRequiredIds: ["rope", "helmet"],
    } as TourCreateFormValues["participation"],
    logistics: {
      primaryTransportMode: "bus",
    } as TourCreateFormValues["logistics"],
  };
  const filtered = filterFormPatchByActiveGroups("cinema_event", clonePatch);
  const merged = mergeTourDraft(base, filtered);

  assert.equal(merged.overview.title, "Cloned Trip");
  assert.deepEqual(
    merged.itinerary,
    base.itinerary,
    "itinerary stays at canonical defaults for cinema_event clone",
  );
  assert.equal(merged.participation.minimumAge, base.participation.minimumAge);
  assert.equal(merged.participation.maximumAge, base.participation.maximumAge);
  assert.deepEqual(merged.participation.skillsRequired, base.participation.skillsRequired);
  assert.deepEqual(merged.participation.gearRequiredIds, base.participation.gearRequiredIds);
  // `logistics` is active for cinema_event, so it still merges (verifies asymmetric handling).
  assert.equal(merged.logistics.primaryTransportMode, "bus");
});

test("integration with mergeTourDraft: general profile preset round-trips all roots (regression guard)", () => {
  const base = buildTourCreateFormDefaultValues();
  const presetDefaults: Record<string, unknown> = {
    overview: { title: "Hello" },
    participation: { minimumAge: 21 },
    itinerary: { days: [{ dayNumber: 1, segments: [{ title: "Day 1" }] }] },
    logistics: { primaryTransportMode: "plane" },
    autoAcceptRegistrations: false,
  };
  const patch = presetDefaultsToFormPatch(presetDefaults);
  const filtered = filterFormPatchByActiveGroups("general", patch);
  const merged = mergeTourDraft(base, filtered);

  assert.equal(merged.overview.title, "Hello");
  assert.equal(merged.participation.minimumAge, 21);
  assert.equal(merged.itinerary.days.length, 1);
  assert.equal(merged.logistics.primaryTransportMode, "plane");
  assert.equal(merged.autoAcceptRegistrations, false);
});
