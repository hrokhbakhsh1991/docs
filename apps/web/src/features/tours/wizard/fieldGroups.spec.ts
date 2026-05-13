import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_DESCRIPTORS, TOUR_FORM_PROFILE_VALUES } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";

import { mapFormValuesToBackendPayload } from "./domain/mapWizardFormToCreateTourPayload";
import {
  FIELD_GROUP_IDS,
  getActiveFieldGroupsForProfile,
  getInactiveFieldGroupsForProfile,
  getSkippedWizardStepsForProfile,
  getVisibleWizardStepsForProfile,
  inactiveTourCreateRootKeysForProfile,
  isWizardStepRedundantForInactiveTourRoots,
  isWizardStepRedundantForProfile,
  pruneWizardStepsWithoutActiveThemes,
  sanitizeInactiveRootsForProfile,
  stripInactiveTourCreateGroupsForProfile,
  tourCreateRootKeyFromTriggerPath,
} from "./fieldGroups";
import { buildTourCreateFormDefaultValues } from "./tourCreateFormDefaults";

const FIELD_GROUP_ID_SET = new Set(FIELD_GROUP_IDS);

test("descriptor inactiveFieldGroups are subsets of FIELD_GROUP_IDS and match getInactiveFieldGroupsForProfile", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const fromDescriptor = TOUR_FORM_PROFILE_DESCRIPTORS[profile].inactiveFieldGroups;
    for (const slug of fromDescriptor) {
      assert.ok(
        FIELD_GROUP_ID_SET.has(slug as (typeof FIELD_GROUP_IDS)[number]),
        `${profile}: descriptor references unknown field group slug "${slug}"`,
      );
    }
    const fromFn = getInactiveFieldGroupsForProfile(profile);
    assert.equal(fromDescriptor.length, fromFn.size, `${profile}: descriptor vs function size mismatch`);
    for (const slug of fromDescriptor) {
      assert.ok(fromFn.has(slug as never), `${profile}: function missing "${slug}" from descriptor`);
    }
  }
});

test("every TourFormProfile keeps basic_info active", () => {
  for (const p of TOUR_FORM_PROFILE_VALUES) {
    assert.ok(getActiveFieldGroupsForProfile(p).has("basic_info"), `missing basic_info for ${p}`);
  }
});

test("cinema_event inactivates itinerary + participation", () => {
  const inactive = getInactiveFieldGroupsForProfile("cinema_event");
  assert.ok(inactive.has("itinerary"));
  assert.ok(inactive.has("participation"));
  assert.ok(!inactive.has("logistics"));
});

test("urban_event also inactivates logistics", () => {
  const inactive = getInactiveFieldGroupsForProfile("urban_event");
  assert.ok(inactive.has("logistics"));
});

test("skipped steps match v1 product matrix", () => {
  assert.deepEqual(
    [...getSkippedWizardStepsForProfile("cinema_event")].sort(),
    ["itinerary", "participation"].sort(),
  );
  assert.deepEqual(
    [...getSkippedWizardStepsForProfile("urban_event")].sort(),
    ["itinerary", "logistics", "participation"].sort(),
  );
  assert.equal(getSkippedWizardStepsForProfile("general").size, 0);
});

test("inactiveTourCreateRootKeysForProfile urban_event includes logistics root", () => {
  const roots = inactiveTourCreateRootKeysForProfile("urban_event");
  assert.ok(roots.includes("logistics"));
  assert.ok(roots.includes("itinerary"));
});

test("pruneWizardStepsWithoutActiveThemes removes theme when catalog has no active themes after load", () => {
  const base = getVisibleWizardStepsForProfile("general");
  assert.ok(base.includes("theme"));
  const pruned = pruneWizardStepsWithoutActiveThemes(base, {
    themesQueryFinishedLoading: true,
    activeThemeCount: 0,
  });
  assert.ok(!pruned.includes("theme"));
});

test("pruneWizardStepsWithoutActiveThemes keeps theme while themes query still loading", () => {
  const base = getVisibleWizardStepsForProfile("general");
  const pruned = pruneWizardStepsWithoutActiveThemes(base, {
    themesQueryFinishedLoading: false,
    activeThemeCount: 0,
  });
  assert.deepEqual(pruned, [...base]);
});

test("tourCreateRootKeyFromTriggerPath parses first segment", () => {
  assert.equal(tourCreateRootKeyFromTriggerPath("logistics.primaryTransportMode"), "logistics");
  assert.equal(tourCreateRootKeyFromTriggerPath("overview.mainTourThemeId"), "overview");
});

test("isWizardStepRedundantForInactiveTourRoots: capacity when pricing+logistics both inactive", () => {
  const inactive = new Set<keyof TourCreateFormValues>(["pricing", "logistics"]);
  assert.equal(isWizardStepRedundantForInactiveTourRoots("capacity", inactive), true);
});

test("isWizardStepRedundantForInactiveTourRoots: capacity when only logistics inactive", () => {
  const inactive = new Set<keyof TourCreateFormValues>(["logistics"]);
  assert.equal(isWizardStepRedundantForInactiveTourRoots("capacity", inactive), false);
});

test("isWizardStepRedundantForInactiveTourRoots: review never redundant (empty triggers)", () => {
  const inactive = new Set<keyof TourCreateFormValues>(["overview", "pricing"]);
  assert.equal(isWizardStepRedundantForInactiveTourRoots("review", inactive), false);
});

test("isWizardStepRedundantForProfile: capacity redundant for urban + cinema (pricing-only triggers)", () => {
  assert.equal(isWizardStepRedundantForProfile("capacity", "urban_event"), true);
  assert.equal(isWizardStepRedundantForProfile("capacity", "cinema_event"), true);
  assert.equal(isWizardStepRedundantForProfile("capacity", "general"), false);
});

test("getVisibleWizardStepsForProfile: urban_event skips capacity (autoAccept only)", () => {
  assert.deepEqual(
    getVisibleWizardStepsForProfile("urban_event"),
    ["basic", "theme", "location", "policies", "review"],
  );
});

test("stripInactiveTourCreateGroupsForProfile: general leaves values unchanged (by ref)", () => {
  const v = buildTourCreateFormDefaultValues();
  v.itinerary.days[0]!.title = "ghost";
  const out = stripInactiveTourCreateGroupsForProfile("general", v);
  assert.equal(out, v);
  assert.equal(out.itinerary.days[0]!.title, "ghost");
});

test("stripInactiveTourCreateGroupsForProfile: cinema_event clears itinerary and participation roots", () => {
  const v = buildTourCreateFormDefaultValues();
  v.itinerary.days[0]!.title = "should not ship";
  v.participation.requirements = "nope";
  const out = stripInactiveTourCreateGroupsForProfile("cinema_event", v);
  const d = buildTourCreateFormDefaultValues();
  assert.deepEqual(out.itinerary, d.itinerary);
  assert.deepEqual(out.participation, d.participation);
  assert.equal(out.overview, v.overview);
});

test("stripInactiveTourCreateGroupsForProfile: urban_event also clears logistics", () => {
  const v = buildTourCreateFormDefaultValues();
  v.logistics.primaryTransportMode = "bus";
  const out = stripInactiveTourCreateGroupsForProfile("urban_event", v);
  assert.equal(out.logistics.primaryTransportMode, undefined);
});

test("strip + map: cinema_event drops ghost itinerary copy from DTO payload", () => {
  const v = buildTourCreateFormDefaultValues();
  v.overview.title = "تست سینما";
  v.itinerary.days = [
    {
      dayNumber: 1,
      title: "روز مخفی",
      description: "",
      segments: [{ title: "بخش", description: "", activityType: "hike" }],
    },
  ];
  const stripped = stripInactiveTourCreateGroupsForProfile("cinema_event", v);
  const dto = mapFormValuesToBackendPayload(stripped);
  const json = JSON.stringify(dto);
  assert.ok(!json.includes("روز مخفی"));
  assert.ok(!json.includes("بخش"));
});

/** S25 urban — same contract as useTourWizardCreate: stripInactive then mapFormValuesToBackendPayload. */
test("strip + map: urban_event drops ghost itinerary, participation, and logistics from DTO payload", () => {
  const v = buildTourCreateFormDefaultValues();
  v.overview.title = "1234567890 عنوان تست ارسال urban strip";
  v.itinerary.days = [
    {
      dayNumber: 1,
      title: "urban-ghost-day",
      description: "",
      segments: [{ title: "urban-ghost-seg", description: "", activityType: "hike" }],
    },
  ];
  v.participation.requirements = "urban-ghost-participation";
  v.logistics.primaryTransportMode = "bus";
  v.logistics.fuelShareToman = 300_000;
  const stripped = stripInactiveTourCreateGroupsForProfile("urban_event", v);
  const dto = mapFormValuesToBackendPayload(stripped);
  const json = JSON.stringify(dto);
  assert.ok(!json.includes("urban-ghost-day"));
  assert.ok(!json.includes("urban-ghost-seg"));
  assert.ok(!json.includes("urban-ghost-participation"));
  assert.ok(!json.includes('"primaryTransportMode":"bus"'), "logistics root reset to defaults strips bus mode");
});

/** S26 — general profile does not strip roots; ghost itinerary remains in payload string. */
test("strip + map: general profile keeps itinerary ghost in serialized DTO", () => {
  const v = buildTourCreateFormDefaultValues();
  v.overview.title = "1234567890 عنوان تست general";
  v.itinerary.days[0]!.title = "general-keeps-this";
  const stripped = stripInactiveTourCreateGroupsForProfile("general", v);
  assert.equal(stripped, v);
  const dto = mapFormValuesToBackendPayload(stripped);
  assert.ok(JSON.stringify(dto).includes("general-keeps-this"));
});

/* -------------------------------------------------------------------------- *
 * sanitizeInactiveRootsForProfile — Phase-1 wiring for auto-save / restore.
 *
 * Contract: identical to `stripInactiveTourCreateGroupsForProfile` but with
 * the `(values, profile)` argument order used by the wizard's effect call
 * sites. These tests pin that contract so swapping in `sanitize*` at the
 * auto-save / draft-restore boundaries can never diverge from the canonical
 * submit-time strip used by `useTourWizardCreate`.
 * -------------------------------------------------------------------------- */

test("sanitizeInactiveRootsForProfile: no-op for profiles with no inactive groups (returns same reference)", () => {
  const v = buildTourCreateFormDefaultValues();
  v.itinerary.days[0]!.title = "keep-me";
  for (const p of TOUR_FORM_PROFILE_VALUES) {
    if (inactiveTourCreateRootKeysForProfile(p).length !== 0) continue;
    const out = sanitizeInactiveRootsForProfile(v, p);
    assert.equal(out, v, `expected same reference for profile "${p}" (zero-overhead path)`);
  }
});

test("sanitizeInactiveRootsForProfile: cinema_event resets itinerary + participation, keeps logistics", () => {
  const v = buildTourCreateFormDefaultValues();
  v.itinerary.days[0]!.title = "ghost-day";
  v.participation.requirements = "ghost-participation";
  v.logistics.primaryTransportMode = "bus";
  const out = sanitizeInactiveRootsForProfile(v, "cinema_event");
  const d = buildTourCreateFormDefaultValues();
  assert.deepEqual(out.itinerary, d.itinerary, "itinerary reset to defaults");
  assert.deepEqual(out.participation, d.participation, "participation reset to defaults");
  assert.equal(out.logistics, v.logistics, "logistics reference untouched (active for cinema_event)");
  assert.equal(out.overview, v.overview, "overview reference untouched (active)");
});

test("sanitizeInactiveRootsForProfile: urban_event also resets logistics root", () => {
  const v = buildTourCreateFormDefaultValues();
  v.logistics.primaryTransportMode = "bus";
  v.logistics.fuelShareToman = 250_000;
  v.itinerary.days[0]!.title = "ghost-urban-day";
  v.participation.requirements = "ghost-urban-participation";
  const out = sanitizeInactiveRootsForProfile(v, "urban_event");
  const d = buildTourCreateFormDefaultValues();
  assert.deepEqual(out.itinerary, d.itinerary);
  assert.deepEqual(out.participation, d.participation);
  assert.deepEqual(out.logistics, d.logistics);
  assert.equal(out.overview, v.overview);
});

test("sanitizeInactiveRootsForProfile: idempotent across both event profiles", () => {
  const v = buildTourCreateFormDefaultValues();
  v.itinerary.days[0]!.title = "x";
  v.participation.requirements = "y";
  v.logistics.primaryTransportMode = "bus";
  for (const p of ["cinema_event", "urban_event"] as const) {
    const once = sanitizeInactiveRootsForProfile(v, p);
    const twice = sanitizeInactiveRootsForProfile(once, p);
    assert.deepEqual(once, twice, `sanitize is idempotent for "${p}"`);
  }
});

test("sanitizeInactiveRootsForProfile produces same DTO payload as stripInactiveTourCreateGroupsForProfile", () => {
  // Locks the equivalence contract so callers at auto-save / restore can never silently
  // diverge from the canonical submit-time strip in `useTourWizardCreate`.
  for (const p of TOUR_FORM_PROFILE_VALUES) {
    const v = buildTourCreateFormDefaultValues();
    v.overview.title = `submit-equivalence-${p}`;
    v.itinerary.days[0]!.title = `${p}-itinerary-ghost`;
    v.itinerary.days[0]!.segments[0]!.title = `${p}-segment-ghost`;
    v.participation.requirements = `${p}-participation-ghost`;
    v.logistics.primaryTransportMode = "bus";
    v.logistics.fuelShareToman = 123_456;
    const fromStrip = mapFormValuesToBackendPayload(stripInactiveTourCreateGroupsForProfile(p, v));
    const fromSanitize = mapFormValuesToBackendPayload(sanitizeInactiveRootsForProfile(v, p));
    assert.deepEqual(fromSanitize, fromStrip, `payload parity must hold for profile "${p}"`);
  }
});

test("sanitizeInactiveRootsForProfile composes with submit-time strip (early sanitize === late strip)", () => {
  // Models the production call chain: auto-save sanitizes the on-disk envelope, restore
  // brings it back, then `useTourWizardCreate` runs the canonical strip before mapping
  // to the DTO. The final payload must equal "just run strip late".
  for (const p of ["cinema_event", "urban_event"] as const) {
    const v = buildTourCreateFormDefaultValues();
    v.overview.title = "compose";
    v.itinerary.days[0]!.title = "x";
    v.participation.requirements = "y";
    v.logistics.primaryTransportMode = "bus";
    const early = mapFormValuesToBackendPayload(
      stripInactiveTourCreateGroupsForProfile(p, sanitizeInactiveRootsForProfile(v, p)),
    );
    const late = mapFormValuesToBackendPayload(stripInactiveTourCreateGroupsForProfile(p, v));
    assert.deepEqual(early, late, `early sanitize must not alter the late submit payload for "${p}"`);
  }
});
