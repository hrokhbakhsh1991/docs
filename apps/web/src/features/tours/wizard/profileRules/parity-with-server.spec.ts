import assert from "node:assert/strict";
import test from "node:test";

import {
  MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS,
  TOUR_DOMAIN_PROFILE_VALUES,
  TOUR_FORM_PROFILE_DESCRIPTORS,
  TOUR_FORM_PROFILE_VALUES,
  URBAN_LOGISTICS_WHITELIST_KEYS,
  mountainOnlyTripDetailsOverviewFieldIds,
  type TourDomainProfile,
  type TourFormProfile,
} from "@repo/types";

import { getTripDetailsFieldConfigForProfile } from "@/features/tours/config/tripDetailsFieldConfigAdapter";
import { getInactiveFieldGroupsForProfile } from "@/features/tours/wizard/fieldGroups";
import { getStepRule } from "./getProfileRules";

/**
 * Phase C parity safety net for the unified-domain plan.
 *
 * These assertions pin the contract between three layers that previously drifted
 * (mismatches M-6 / M-7 in `prompt.md`):
 *
 *  1. `@repo/types/src/tour-domain-profile.ts:URBAN_LOGISTICS_WHITELIST_KEYS`
 *     — canonical server-side strip whitelist for `urban_event`.
 *  2. The wizard rules layer (`profileRules/rules.ts` + `fieldGroups.ts`)
 *     — what the wizard *collects* per profile.
 *  3. The server's `stripTripDetailsForFormProfile`
 *     — what the server *retains* per profile (data invariant: anything in (2)
 *     either stays put in (3) or is keyed in `URBAN_LOGISTICS_WHITELIST_KEYS`).
 *
 * Any future change that breaks one of these without the others should fail here
 * loudly, NOT in a manual QA pass on cinema/urban tours.
 */

test("URBAN_LOGISTICS_WHITELIST_KEYS is non-empty and alphabetically sorted", () => {
  assert.ok(URBAN_LOGISTICS_WHITELIST_KEYS.length > 0);
  const sorted = [...URBAN_LOGISTICS_WHITELIST_KEYS].sort((a, b) => a.localeCompare(b));
  assert.deepEqual([...URBAN_LOGISTICS_WHITELIST_KEYS], sorted);
});

test("urban_event: wizard logistics step is hidden — server strips the whole logistics group except the whitelist", () => {
  const rule = getStepRule("urban_event", "logistics");
  assert.equal(rule?.visibility, "hidden", "logistics step must be hidden for urban_event");
  const inactive = getInactiveFieldGroupsForProfile("urban_event");
  assert.ok(inactive.has("logistics"), "logistics group must be inactive for urban_event");
});

test("urban_event: wizard schedule_location group stays active — the whitelist keys live there", () => {
  const inactive = getInactiveFieldGroupsForProfile("urban_event");
  assert.ok(
    !inactive.has("schedule_location"),
    "schedule_location must stay active for urban_event so the form still collects the whitelist keys",
  );
});

test("cinema_event: itinerary + participation hidden in wizard, logistics retained", () => {
  const inactive = getInactiveFieldGroupsForProfile("cinema_event");
  assert.ok(inactive.has("itinerary"));
  assert.ok(inactive.has("participation"));
  assert.ok(
    !inactive.has("logistics"),
    "cinema_event must retain logistics (only the urban variant strips it)",
  );
});

test("non-cinema / non-urban profiles strip nothing", () => {
  const profilesThatStrip = new Set<TourDomainProfile>(["cinema_event", "urban_event"]);
  for (const profile of TOUR_DOMAIN_PROFILE_VALUES) {
    if (profilesThatStrip.has(profile)) continue;
    const inactive = getInactiveFieldGroupsForProfile(profile);
    assert.equal(
      inactive.size,
      0,
      `${profile}: expected no inactive groups, got ${[...inactive].join(",")}`,
    );
  }
});

test("mountainOnlyTripDetailsOverviewFieldIds mirrors canonical MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS", () => {
  assert.deepEqual(
    [...mountainOnlyTripDetailsOverviewFieldIds()].sort(),
    [...MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS.map((k) => `overview.${k}`)].sort(),
  );
});

/**
 * Phase P2 fitness check: `MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS` is the canonical
 * source-of-truth shared by:
 *   - api `tour-type-gates.ts` (server-side strip — reads `mountainOverviewKeysToStripFromOverview` on the profile descriptor),
 *   - web `tripDetailsFieldConfig.ts` (Edit matrix — hidden ids via `mountainOnlyTripDetailsOverviewFieldIds()` from `@repo/types`).
 *
 * If the canonical list grows but the web matrix forgets to mirror it (or vice versa), this
 * test fails fast — well before the Edit form leaks a stale field to a non-`mountain_outdoor`
 * tour. Replaces what would otherwise be a manual QA pass on cross-profile Edit flows.
 */
test("mountain-only overview keys: canonical constant equals web matrix hidden-field count for non-mountain profiles", () => {
  assert.ok(
    MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS.length > 0,
    "MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS must declare at least one key — empty list would silently disable the mountain gate.",
  );

  const expectedIds = new Set(
    MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS.map((k) => `overview.${k}`),
  );

  for (const profile of TOUR_DOMAIN_PROFILE_VALUES) {
    if (profile === "mountain_outdoor") continue;
    const rows = getTripDetailsFieldConfigForProfile(profile);
    const hiddenMountainOnly = rows.filter(
      (row) => expectedIds.has(row.id) && row.visibility === "hidden",
    );
    assert.equal(
      hiddenMountainOnly.length,
      expectedIds.size,
      `${profile}: web matrix must hide every mountain-only key from the canonical constant. ` +
        `Expected ${expectedIds.size}, got ${hiddenMountainOnly.length}. ` +
        `Missing: ${[...expectedIds]
          .filter((id) => !hiddenMountainOnly.some((r) => r.id === id))
          .join(", ") || "(none — check requiredness)"}`,
    );
  }
});

/**
 * Phase P10 (promptq.md) — descriptor-driven parity safety net.
 *
 * Pins the in-package descriptor table against the wizard-side `fieldGroups` rail and
 * the canonical urban-logistics whitelist. If a future change drops or renames a slug
 * in either layer without updating the other, this fails fast — exactly the kind of
 * cross-package regression that motivated the descriptor table in the first place.
 */
test("descriptor parity: inactive field groups match getInactiveFieldGroupsForProfile across every profile", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const fromDescriptor = new Set(TOUR_FORM_PROFILE_DESCRIPTORS[profile].inactiveFieldGroups);
    const fromWebRail = getInactiveFieldGroupsForProfile(profile as TourFormProfile);
    assert.equal(
      fromDescriptor.size,
      fromWebRail.size,
      `${profile}: descriptor inactiveFieldGroups (${[...fromDescriptor].join(",") || "(empty)"}) ` +
        `must match web fieldGroups (${[...fromWebRail].join(",") || "(empty)"})`,
    );
    for (const slug of fromDescriptor) {
      assert.ok(
        fromWebRail.has(slug as never),
        `${profile}: web fieldGroups is missing "${slug}" advertised by descriptor`,
      );
    }
  }
});

test("descriptor parity: urban_event logistics whitelist is exactly URBAN_LOGISTICS_WHITELIST_KEYS", () => {
  const fromDescriptor = TOUR_FORM_PROFILE_DESCRIPTORS.urban_event.strip.logisticsWhitelist;
  assert.ok(fromDescriptor, "urban_event must declare logisticsWhitelist in its descriptor row");
  assert.deepEqual([...fromDescriptor!].sort(), [...URBAN_LOGISTICS_WHITELIST_KEYS].sort());
});

test("descriptor parity: only urban_event clears root transportModes (matches existing server strip)", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const expected = profile === "urban_event";
    assert.equal(
      TOUR_FORM_PROFILE_DESCRIPTORS[profile].strip.clearsRootTransportModes,
      expected,
      `${profile}.strip.clearsRootTransportModes drift`,
    );
  }
});

test("mountain-only overview keys: kept visible for mountain_outdoor profile", () => {
  const expectedIds = new Set(
    MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS.map((k) => `overview.${k}`),
  );
  const rows = getTripDetailsFieldConfigForProfile("mountain_outdoor");
  for (const id of expectedIds) {
    const row = rows.find((r) => r.id === id);
    assert.ok(row, `mountain_outdoor: expected matrix row for ${id}`);
    assert.notEqual(
      row!.visibility,
      "hidden",
      `mountain_outdoor: ${id} must be visible (not hidden) on its native profile`,
    );
  }
});
