import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  TOUR_FORM_PROFILE_VALUES,
  defaultTourFormProfileForTourType,
} from "./tour-form-profile";
import {
  MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS,
  TOUR_FORM_PROFILE_DESCRIPTORS,
  __assertDescriptorTotality,
  getTourFormProfileDescriptor,
} from "./tour-form-profile-descriptors";
import { URBAN_LOGISTICS_WHITELIST_KEYS } from "./tour-domain-profile";
import {
  MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS as MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS_SHIM,
  type MountainOnlyTripDetailsOverviewKey as MountainOnlyTripDetailsOverviewKey_SHIM,
} from "./trip-details-inventory-policy";

// Compile-time sanity: the shim's type alias must resolve to the same union as the descriptor
// module's. If they ever diverge, this assignment fails at `tsc --noEmit`.
const _shimTypeCheck: MountainOnlyTripDetailsOverviewKey_SHIM = "maxAltitudeMeters" as const;
void _shimTypeCheck;

/**
 * Parity tests for Phase P10 — descriptor table.
 *
 * These tests pin the descriptor rows to the **observable behavior** of the existing
 * scattered switch statements. When a consumer is migrated to read its decision from
 * the descriptor in subsequent P10 steps, these tests guarantee no behavior change.
 *
 * If a future profile is added without a descriptor row, `descriptor totality` fails
 * loudly so the new profile cannot be merged half-wired.
 */
describe("TOUR_FORM_PROFILE_DESCRIPTORS — totality", () => {
  it("has one row per TOUR_FORM_PROFILE_VALUES literal", () => {
    for (const profile of TOUR_FORM_PROFILE_VALUES) {
      assert.ok(
        TOUR_FORM_PROFILE_DESCRIPTORS[profile],
        `missing descriptor row for "${profile}" — add it to TOUR_FORM_PROFILE_DESCRIPTORS`,
      );
      assert.equal(TOUR_FORM_PROFILE_DESCRIPTORS[profile].slug, profile);
    }
    __assertDescriptorTotality();
  });

  it("getTourFormProfileDescriptor returns total rows for every literal", () => {
    for (const profile of TOUR_FORM_PROFILE_VALUES) {
      const row = getTourFormProfileDescriptor(profile);
      assert.equal(row.slug, profile);
    }
  });
});

describe("TOUR_FORM_PROFILE_DESCRIPTORS — defaultTourType ↔ defaultTourFormProfileForTourType", () => {
  it("when defaultTourType is set, the inverse mapping resolves back to the same profile slug", () => {
    for (const profile of TOUR_FORM_PROFILE_VALUES) {
      const { defaultTourType } = TOUR_FORM_PROFILE_DESCRIPTORS[profile];
      if (defaultTourType == null) continue;
      assert.equal(
        defaultTourFormProfileForTourType(defaultTourType),
        profile,
        `defaultTourFormProfileForTourType("${defaultTourType}") expected "${profile}" — descriptor row drifted`,
      );
    }
  });
});

describe("TOUR_FORM_PROFILE_DESCRIPTORS — strip deltas mirror server stripTripDetailsForFormProfile", () => {
  it("urban_event clears participation + itinerary day plans + transport modes + whitelists logistics", () => {
    const d = TOUR_FORM_PROFILE_DESCRIPTORS.urban_event.strip;
    assert.deepEqual([...d.clearsTripDetailsRoots].sort(), ["participation"]);
    assert.deepEqual([...d.itineraryKeysToDelete].sort(), ["dayPlans", "segmentActivities"]);
    assert.equal(d.clearsRootTransportModes, true);
    assert.deepEqual(d.logisticsWhitelist, URBAN_LOGISTICS_WHITELIST_KEYS);
  });

  it("cinema_event clears participation + itinerary day plans, keeps logistics + transport modes", () => {
    const d = TOUR_FORM_PROFILE_DESCRIPTORS.cinema_event.strip;
    assert.deepEqual([...d.clearsTripDetailsRoots].sort(), ["participation"]);
    assert.deepEqual([...d.itineraryKeysToDelete].sort(), ["dayPlans", "segmentActivities"]);
    assert.equal(d.clearsRootTransportModes, false);
    assert.equal(d.logisticsWhitelist, undefined);
  });

  it("general / mountain_outdoor / nature_trip / cultural_tour have empty strip deltas (no profile-specific server strip)", () => {
    for (const slug of ["general", "mountain_outdoor", "nature_trip", "cultural_tour"] as const) {
      const d = TOUR_FORM_PROFILE_DESCRIPTORS[slug].strip;
      assert.deepEqual(d.clearsTripDetailsRoots, [], `${slug}: clearsTripDetailsRoots should be empty`);
      assert.deepEqual(d.itineraryKeysToDelete, [], `${slug}: itineraryKeysToDelete should be empty`);
      assert.equal(d.clearsRootTransportModes, false, `${slug}: clearsRootTransportModes should be false`);
      assert.equal(d.logisticsWhitelist, undefined, `${slug}: logisticsWhitelist should be undefined`);
    }
  });
});

describe("TOUR_FORM_PROFILE_DESCRIPTORS — invariant hints mirror server applyMountainOverviewFieldGatesForFormProfile", () => {
  it("only mountain_outdoor permits mountain-only overview keys", () => {
    for (const profile of TOUR_FORM_PROFILE_VALUES) {
      const expected = profile === "mountain_outdoor";
      assert.equal(
        TOUR_FORM_PROFILE_DESCRIPTORS[profile].invariants.allowsMountainOnlyOverviewKeys,
        expected,
        `${profile}.invariants.allowsMountainOnlyOverviewKeys should be ${expected}`,
      );
    }
  });

  it("allowsMountainOnlyOverviewKeys mirrors empty mountainOverviewKeysToStripFromOverview", () => {
    for (const profile of TOUR_FORM_PROFILE_VALUES) {
      const { allowsMountainOnlyOverviewKeys, mountainOverviewKeysToStripFromOverview } =
        TOUR_FORM_PROFILE_DESCRIPTORS[profile].invariants;
      assert.equal(
        allowsMountainOnlyOverviewKeys,
        mountainOverviewKeysToStripFromOverview.length === 0,
        `${profile}: mountain gate flags drifted`,
      );
    }
  });

  it("only urban_event requires empty root transportModes (mirrors strip.clearsRootTransportModes)", () => {
    for (const profile of TOUR_FORM_PROFILE_VALUES) {
      const expected = profile === "urban_event";
      const row = TOUR_FORM_PROFILE_DESCRIPTORS[profile];
      assert.equal(
        row.invariants.requiresEmptyRootTransportModes,
        expected,
        `${profile}.invariants.requiresEmptyRootTransportModes should be ${expected}`,
      );
      assert.equal(
        row.invariants.requiresEmptyRootTransportModes,
        row.strip.clearsRootTransportModes,
        `${profile}: invariants and strip disagree on root transportModes`,
      );
    }
  });
});

describe("TOUR_FORM_PROFILE_DESCRIPTORS — inactiveFieldGroups mirror web getInactiveFieldGroupsForProfile", () => {
  it("urban_event drops itinerary + participation + logistics groups", () => {
    assert.deepEqual(
      [...TOUR_FORM_PROFILE_DESCRIPTORS.urban_event.inactiveFieldGroups].sort(),
      ["itinerary", "logistics", "participation"],
    );
  });

  it("cinema_event drops itinerary + participation groups", () => {
    assert.deepEqual(
      [...TOUR_FORM_PROFILE_DESCRIPTORS.cinema_event.inactiveFieldGroups].sort(),
      ["itinerary", "participation"],
    );
  });

  it("general / mountain_outdoor / nature_trip / cultural_tour / denali_pilot show every field group", () => {
    for (const slug of [
      "general",
      "mountain_outdoor",
      "nature_trip",
      "cultural_tour",
      "denali_pilot",
    ] as const) {
      assert.deepEqual(
        TOUR_FORM_PROFILE_DESCRIPTORS[slug].inactiveFieldGroups,
        [],
        `${slug} should have no inactive field groups`,
      );
    }
  });
});

describe("TOUR_FORM_PROFILE_DESCRIPTORS — mountain overview strip list (API gate)", () => {
  it("mountain_outdoor strips nothing; every other profile strips the canonical mountain-only keys", () => {
    for (const profile of TOUR_FORM_PROFILE_VALUES) {
      const strip =
        TOUR_FORM_PROFILE_DESCRIPTORS[profile].invariants.mountainOverviewKeysToStripFromOverview;
      if (profile === "mountain_outdoor") {
        assert.deepEqual(strip, []);
      } else {
        assert.deepEqual([...strip].sort(), [...MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS].sort());
      }
    }
  });

  /**
   * Phase P14 — the canonical authoring location for `MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS`
   * was moved into `tour-form-profile-descriptors.ts`; the legacy `trip-details-inventory-policy`
   * module survives only as a back-compat re-export shim. This test pins the equivalence so
   * any future drift (someone re-defining the constant in the shim) fails CI loudly.
   */
  it("P14: back-compat shim in trip-details-inventory-policy re-exports the descriptor module's tuple identity", () => {
    assert.equal(
      MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS_SHIM,
      MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS,
      "shim must be the same tuple reference, not a copy",
    );
    assert.deepEqual(
      [...MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS_SHIM],
      [...MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS],
    );
  });
});

describe("TOUR_FORM_PROFILE_DESCRIPTORS — wizard capacity step redundancy", () => {
  it("only urban_event and cinema_event mark the capacity step redundant", () => {
    for (const profile of TOUR_FORM_PROFILE_VALUES) {
      const expected = profile === "urban_event" || profile === "cinema_event";
      assert.equal(TOUR_FORM_PROFILE_DESCRIPTORS[profile].wizardCapacityStepRedundant, expected);
    }
  });
});

describe("TOUR_FORM_PROFILE_DESCRIPTORS — Edit mountain_outdoor preset overrides", () => {
  it("carries exactly 10 preset rows for the mountain trip-details base matrix", () => {
    const p = TOUR_FORM_PROFILE_DESCRIPTORS.mountain_outdoor.edit.tripDetailsPresetOverrides;
    assert.equal(p.length, 10);
    assert.ok(p.every((r) => r.visibility === "editable"));
  });
});

describe("TOUR_FORM_PROFILE_DESCRIPTORS — displayKeyFa matches web PROFILE_DISPLAY_KEYS shape", () => {
  it("every displayKeyFa is the canonical `tours.profiles.<slug>` i18n key", () => {
    for (const profile of TOUR_FORM_PROFILE_VALUES) {
      assert.equal(
        TOUR_FORM_PROFILE_DESCRIPTORS[profile].displayKeyFa,
        `tours.profiles.${profile}`,
        `${profile}.displayKeyFa should follow the tours.profiles.* convention`,
      );
    }
  });
});
