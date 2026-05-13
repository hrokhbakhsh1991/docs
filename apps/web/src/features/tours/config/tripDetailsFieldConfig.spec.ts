import assert from "node:assert/strict";
import test from "node:test";

import {
  MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS,
  TOUR_FORM_PROFILE_VALUES,
  type TourFormProfile,
} from "@repo/types";

import { getFieldRule } from "@/features/tours/wizard/profileRules/getProfileRules";

import {
  getCoreFieldConfigForProfileBase,
  getTripDetailsFieldConfigForProfileBase,
  type TripDetailsFieldConfig,
} from "./tripDetailsFieldConfig";
import {
  EDIT_TO_WIZARD_PATH_ALIASES,
  getTripDetailsFieldConfigForProfile,
} from "./tripDetailsFieldConfigAdapter";

/**
 * Phase P6 (promptq.md) regression net for the Edit-side trip-details / core matrix.
 *
 * After flipping the matrix axis from `EventKind` → `TourFormProfile`, these tests pin:
 *   1. The base matrix is total over `TOUR_FORM_PROFILE_VALUES` (no missing profile).
 *   2. Every profile returns one row per `TripDetailsFieldId` (no dropped paths).
 *   3. Mountain-only overview keys (`MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS`) are
 *      `visibility: "hidden"` for every non-`mountain_outdoor` profile and `visibility: "editable"`
 *      for `mountain_outdoor`.
 *   4. The `mountain_outdoor` profile carries its required/recommended overrides exactly
 *      where the legacy `MOUNTAIN_OVERRIDES` placed them. (Adapter overlay may downgrade
 *      these for paths registered in `BASE_FIELD_RULES`; the base matrix must still
 *      declare them so the matrix-only fields keep working.)
 *   5. Core capacity rows are `leader+` for view/edit on every profile.
 *   6. The adapter never returns a row that does not exist in the base matrix.
 *
 * If any one of these breaks, the Edit form has silently changed behavior for at least one
 * profile.
 */

const MOUNTAIN_ONLY_IDS = MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS.map(
  (k) => `overview.${k}`,
);

const MOUNTAIN_OUTDOOR_EXPECTED_OVERRIDES: Record<string, { visibility: TripDetailsFieldConfig["visibility"]; requiredness: TripDetailsFieldConfig["requiredness"] }> = {
  "participation.minimumAge": { visibility: "editable", requiredness: "required" },
  "overview.difficultyLevel": { visibility: "editable", requiredness: "required" },
  "participation.gearRequiredIds": { visibility: "editable", requiredness: "required" },
  "participation.technicalSkillRequired": { visibility: "editable", requiredness: "recommended" },
  "logistics.meetingPoint": { visibility: "editable", requiredness: "required" },
  "logistics.departureDate": { visibility: "editable", requiredness: "required" },
  "logistics.returnDate": { visibility: "editable", requiredness: "recommended" },
  "logistics.transportationNotes": { visibility: "editable", requiredness: "recommended" },
  "logistics.groupSizeMin": { visibility: "editable", requiredness: "recommended" },
  "logistics.groupSizeMax": { visibility: "editable", requiredness: "recommended" },
};

test("base matrix is total over TOUR_FORM_PROFILE_VALUES", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const rows = getTripDetailsFieldConfigForProfileBase(profile);
    assert.ok(rows.length > 0, `${profile}: base matrix returned no rows`);
    const ids = new Set(rows.map((r) => r.id));
    assert.equal(ids.size, rows.length, `${profile}: duplicate row ids in base matrix`);
  }
});

test("base matrix: mountain-only overview keys are hidden on every non-mountain profile", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    if (profile === "mountain_outdoor") continue;
    const rows = getTripDetailsFieldConfigForProfileBase(profile);
    for (const id of MOUNTAIN_ONLY_IDS) {
      const row = rows.find((r) => r.id === id);
      assert.ok(row, `${profile}: missing mountain-only row ${id}`);
      assert.equal(
        row!.visibility,
        "hidden",
        `${profile}: ${id} must be hidden on non-mountain profiles, got "${row!.visibility}"`,
      );
      assert.equal(row!.requiredness, "optional", `${profile}: ${id} must be optional when hidden`);
    }
  }
});

test("base matrix: mountain-only overview keys are visible on mountain_outdoor", () => {
  const rows = getTripDetailsFieldConfigForProfileBase("mountain_outdoor");
  for (const id of MOUNTAIN_ONLY_IDS) {
    const row = rows.find((r) => r.id === id);
    assert.ok(row, `mountain_outdoor: missing mountain-only row ${id}`);
    assert.notEqual(
      row!.visibility,
      "hidden",
      `mountain_outdoor: ${id} must be editable on its native profile`,
    );
  }
});

test("mountain_outdoor base matrix carries the canonical required/recommended overrides", () => {
  const rows = getTripDetailsFieldConfigForProfileBase("mountain_outdoor");
  for (const [id, expected] of Object.entries(MOUNTAIN_OUTDOOR_EXPECTED_OVERRIDES)) {
    const row = rows.find((r) => r.id === id);
    assert.ok(row, `mountain_outdoor: missing override row ${id}`);
    assert.equal(
      row!.visibility,
      expected.visibility,
      `mountain_outdoor: ${id} visibility expected ${expected.visibility}, got ${row!.visibility}`,
    );
    assert.equal(
      row!.requiredness,
      expected.requiredness,
      `mountain_outdoor: ${id} requiredness expected ${expected.requiredness}, got ${row!.requiredness}`,
    );
  }
});

test("non-mountain_outdoor profiles share an identical base matrix (no per-profile drift)", () => {
  // Canonical: each non-mountain profile yields the same set of rows. The wizard rules
  // overlay (in the adapter) is what differentiates them — the base matrix should NOT.
  const profiles: readonly TourFormProfile[] = TOUR_FORM_PROFILE_VALUES.filter(
    (p) => p !== "mountain_outdoor",
  );
  const reference = JSON.stringify(getTripDetailsFieldConfigForProfileBase(profiles[0]));
  for (const profile of profiles.slice(1)) {
    const candidate = JSON.stringify(getTripDetailsFieldConfigForProfileBase(profile));
    assert.equal(
      candidate,
      reference,
      `${profile}: base matrix differs from ${profiles[0]} — non-mountain profiles must share one baseline`,
    );
  }
});

test("core capacity rows: leader+ minRoleForView / minRoleForEdit on every profile", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const rows = getCoreFieldConfigForProfileBase(profile);
    for (const row of rows) {
      assert.equal(row.role?.minRoleForView, "leader", `${profile}/${row.id}: minRoleForView should be leader`);
      assert.equal(row.role?.minRoleForEdit, "leader", `${profile}/${row.id}: minRoleForEdit should be leader`);
    }
  }
});

test("adapter: every row it returns exists in the base matrix (no synthesized ids)", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const base = new Set(getTripDetailsFieldConfigForProfileBase(profile).map((r) => r.id));
    const adapted = getTripDetailsFieldConfigForProfile(profile);
    for (const row of adapted) {
      assert.ok(
        base.has(row.id),
        `${profile}: adapter returned row ${row.id} that is not in the base matrix`,
      );
    }
    assert.equal(
      adapted.length,
      base.size,
      `${profile}: adapter dropped or duplicated rows (base=${base.size}, adapted=${adapted.length})`,
    );
  }
});

/* ---------------------------------------------------------------------------------------------
 * Phase P16 (promptq.md follow-up) — Edit→wizard path-alias map (pilot row `shortIntro`).
 *
 * The adapter now overlays the wizard rule for the **aliased** wizard path onto the matching
 * Edit row. These tests pin:
 *
 * 1. The alias map is non-empty (regression guard against an accidental wipe).
 * 2. Every alias points at a path that has a corresponding `FieldRule` for at least one
 *    profile (otherwise the overlay is a no-op and the alias is dead config).
 * 3. The pilot row `overview.shortIntro` inherits `requiredness` / `visibility` from
 *    `BASE_FIELD_RULES.overview.shortDescription` for every profile.
 * ------------------------------------------------------------------------------------------- */
test("P16: EDIT_TO_WIZARD_PATH_ALIASES is non-empty and every value is a known wizard path", () => {
  const entries = Object.entries(EDIT_TO_WIZARD_PATH_ALIASES);
  assert.ok(entries.length > 0, "alias map is empty — the convergence pilot row vanished");
  for (const [editId, wizardPath] of entries) {
    assert.ok(wizardPath, `${editId}: alias has no target`);
    const someProfile = TOUR_FORM_PROFILE_VALUES.find(
      (p) => getFieldRule(p, wizardPath!) != null,
    );
    assert.ok(
      someProfile,
      `${editId} → ${wizardPath}: no profile yields a FieldRule for the alias target`,
    );
  }
});

test("P16 pilot: overview.shortIntro inherits visibility+requiredness from overview.shortDescription", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const adapted = getTripDetailsFieldConfigForProfile(profile);
    const row = adapted.find((r) => r.id === "overview.shortIntro");
    assert.ok(row, `${profile}: missing adapted row overview.shortIntro`);
    const wizardRule = getFieldRule(profile, "overview.shortDescription");
    assert.ok(
      wizardRule,
      `${profile}: missing BASE_FIELD_RULES entry for overview.shortDescription (pilot target)`,
    );
    if (wizardRule.visibility === "hidden") {
      assert.equal(row!.visibility, "hidden");
      assert.equal(row!.requiredness, "optional");
      continue;
    }
    assert.equal(
      row!.visibility,
      "editable",
      `${profile}/shortIntro: expected editable when alias target is visible`,
    );
    const expectedRequiredness =
      wizardRule.required === "required"
        ? "required"
        : wizardRule.required === "recommended"
          ? "recommended"
          : "optional";
    assert.equal(
      row!.requiredness,
      expectedRequiredness,
      `${profile}/shortIntro: expected requiredness=${expectedRequiredness} from alias overlay, got ${row!.requiredness}`,
    );
  }
});
