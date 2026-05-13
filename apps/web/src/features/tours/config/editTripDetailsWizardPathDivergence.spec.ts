/**
 * Phase P15 — catalog of **path-namespace divergence** between the Edit trip-details matrix
 * (`TripDetailsFieldId` — logical ids without the `tripDetails.` RHF prefix) and the wizard
 * `BASE_FIELD_RULES` dotted paths (`WizardFieldPath` into `TourCreateFormValues`).
 *
 * This spec exists so a future "delete `tripDetailsFieldConfig.ts` entirely" slice has a
 * **checklist** of every row that must either (a) gain an exact `BASE_FIELD_RULES` path, or
 * (b) keep an explicit alias in the adapter, or (c) remain legitimately Edit-only inventory.
 *
 * The categorisation is **intentionally explicit** — we do not auto-derive it from runtime
 * data, so adding a new `TripDetailsFieldId` without updating this file fails CI loudly.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { __INTERNAL_RULES__ } from "@/features/tours/wizard/profileRules/rules";
import type { WizardFieldPath } from "@/features/tours/wizard/profileRules/types";

import { EDIT_TO_WIZARD_PATH_ALIASES } from "./tripDetailsFieldConfigAdapter";
import { TRIP_DETAILS_FIELD_IDS, type TripDetailsFieldId } from "./tripDetailsFieldConfig";

const WIZARD_PATHS = new Set<string>(
  __INTERNAL_RULES__.BASE_FIELD_RULES.map((r) => r.path as string),
);

/**
 * Edit matrix id → wizard `FieldRule.path` map.
 *
 * **Phase P16 (promptq.md):** the **active** alias map (currently applied by the adapter at
 * runtime) lives in `tripDetailsFieldConfigAdapter.ts:EDIT_TO_WIZARD_PATH_ALIASES`. This
 * spec imports it directly so there is one canonical source of truth.
 *
 * {@link DOCUMENTED_FUTURE_ALIASES} captures the **remaining** divergence rows that have not
 * yet been wired through the adapter (the long tail of the convergence work). The combined
 * view (`EDIT_TO_WIZARD_PATH_ALIASES ∪ DOCUMENTED_FUTURE_ALIASES`) is what the third
 * categorisation test below considers, so the catalog stays complete even while the adapter
 * graduates aliases one at a time.
 */
const DOCUMENTED_FUTURE_ALIASES: Partial<Record<TripDetailsFieldId, WizardFieldPath>> = {
  "overview.mainDestination": "location.mainDestinationId" as WizardFieldPath,
  "overview.destinationRegion": "location.regionId" as WizardFieldPath,
  "overview.tourThemeIds": "overview.mainTourThemeId" as WizardFieldPath,
  "logistics.meetingPoint": "location.meetingPoint" as WizardFieldPath,
  "logistics.departureMeetingTime": "schedule.departureMeetingTime" as WizardFieldPath,
  "logistics.departureDate": "schedule.startDate" as WizardFieldPath,
  "logistics.returnDate": "schedule.endDate" as WizardFieldPath,
  "logistics.returnPoint": "location.returnPoint" as WizardFieldPath,
  "participation.fitnessLevel": "participation.requiredFitnessLevel" as WizardFieldPath,
  "participation.experienceLevel": "participation.requiredExperienceLevel" as WizardFieldPath,
};

const ALL_KNOWN_ALIASES: Partial<Record<TripDetailsFieldId, WizardFieldPath>> = {
  ...DOCUMENTED_FUTURE_ALIASES,
  ...EDIT_TO_WIZARD_PATH_ALIASES,
};

/** Inventory rows that legitimately have **no** wizard `FieldRule` today (Edit DTO only). */
const EDIT_ONLY_NO_WIZARD_RULE: ReadonlySet<TripDetailsFieldId> = new Set([
  "overview.difficultyLevel",
  "overview.elevationGainMeters",
  "overview.maxAltitudeMeters",
  "itinerary.highlights",
  "itinerary.includedVisits",
  "itinerary.excludedVisits",
  "itinerary.optionalActivities",
  "itinerary.outline",
  "itinerary.programNotes",
  "itinerary.specialExperiences",
  "itinerary.dayPlans",
]);

test("P15+P16: every documented + active alias target path exists in BASE_FIELD_RULES", () => {
  for (const [, wizardPath] of Object.entries(ALL_KNOWN_ALIASES) as Array<
    [TripDetailsFieldId, WizardFieldPath]
  >) {
    assert.ok(
      WIZARD_PATHS.has(wizardPath),
      `alias → ${wizardPath}: wizard path missing from BASE_FIELD_RULES`,
    );
  }
});

test("P16: active EDIT_TO_WIZARD_PATH_ALIASES (in adapter) is a subset of the documented catalog", () => {
  for (const [editId, wizardPath] of Object.entries(EDIT_TO_WIZARD_PATH_ALIASES) as Array<
    [TripDetailsFieldId, WizardFieldPath]
  >) {
    assert.equal(
      ALL_KNOWN_ALIASES[editId],
      wizardPath,
      `${editId}: adapter alias → ${wizardPath} disagrees with documented catalog → ${ALL_KNOWN_ALIASES[editId] ?? "<missing>"}`,
    );
  }
});

test("P15+P16: every TRIP_DETAILS_FIELD_ID is either an exact wizard path, a documented alias, or Edit-only inventory", () => {
  for (const id of TRIP_DETAILS_FIELD_IDS) {
    if (WIZARD_PATHS.has(id)) {
      assert.ok(
        !ALL_KNOWN_ALIASES[id],
        `${id}: listed both as exact wizard match and in the alias catalog — remove duplicate`,
      );
      assert.ok(
        !EDIT_ONLY_NO_WIZARD_RULE.has(id),
        `${id}: listed both as exact wizard match and EDIT_ONLY — remove duplicate`,
      );
      continue;
    }
    if (ALL_KNOWN_ALIASES[id]) continue;
    assert.ok(
      EDIT_ONLY_NO_WIZARD_RULE.has(id),
      `${id}: not an exact wizard path, not in any alias map, and not in EDIT_ONLY_NO_WIZARD_RULE — classify it`,
    );
  }
});

test("P15: TRIP_DETAILS_FIELD_IDS has no duplicates", () => {
  const unique = new Set(TRIP_DETAILS_FIELD_IDS);
  assert.equal(unique.size, TRIP_DETAILS_FIELD_IDS.length, "TRIP_DETAILS_FIELD_IDS contains duplicates");
});
