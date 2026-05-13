import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VALUES } from "@repo/types";

import {
  getInactiveFieldGroupsForProfile,
  getVisibleWizardStepsForProfile,
  inactiveTourCreateRootKeysForProfile,
} from "@/features/tours/wizard/fieldGroups";
import { stepTriggerFields } from "@/features/tours/wizard/stepConfig";

import {
  getFieldRule,
  getInactiveFieldGroups,
  getInactiveRootKeys,
  getProfileRules,
  getStepRule,
  getStepRules,
  getVisibleStepIds,
  isFieldRecommended,
  isFieldRequiredAtLevel,
  isFieldVisible,
} from "./getProfileRules";
import { __INTERNAL_RULES__ } from "./rules";
import { getTourFormProfileDescriptor } from "@repo/types";

test("parity: getVisibleStepIds matches getVisibleWizardStepsForProfile for every profile", () => {
  for (const p of TOUR_FORM_PROFILE_VALUES) {
    assert.deepEqual(
      [...getVisibleStepIds(p)],
      [...getVisibleWizardStepsForProfile(p)],
      `visible steps differ for ${p}`,
    );
  }
});

test("parity: getInactiveRootKeys matches inactiveTourCreateRootKeysForProfile for every profile", () => {
  for (const p of TOUR_FORM_PROFILE_VALUES) {
    assert.deepEqual(
      [...getInactiveRootKeys(p)].sort(),
      [...inactiveTourCreateRootKeysForProfile(p)].sort(),
      `inactive roots differ for ${p}`,
    );
  }
});

test("parity: getInactiveFieldGroups matches getInactiveFieldGroupsForProfile for every profile", () => {
  for (const p of TOUR_FORM_PROFILE_VALUES) {
    assert.deepEqual(
      [...getInactiveFieldGroups(p)].sort(),
      [...getInactiveFieldGroupsForProfile(p)].sort(),
      `inactive groups differ for ${p}`,
    );
  }
});

test("base rules cover every stepTriggerFields path (no missing field)", () => {
  const known = new Set(__INTERNAL_RULES__.BASE_FIELD_RULES.map((r) => r.path));
  for (const triggers of Object.values(stepTriggerFields)) {
    for (const path of triggers) {
      assert.ok(
        known.has(path as string),
        `BASE_FIELD_RULES is missing an entry for trigger path "${String(path)}"`,
      );
    }
  }
});

test("rules table is well-formed: every field's belongsToStep exists", () => {
  for (const p of TOUR_FORM_PROFILE_VALUES) {
    const rules = getProfileRules(p);
    for (const rule of rules.fields.values()) {
      assert.ok(
        rules.steps.has(rule.belongsToStep),
        `field "${rule.path}" references unknown step "${rule.belongsToStep}"`,
      );
    }
  }
});

test("getFieldRule returns undefined for unknown paths and a rule for known paths", () => {
  assert.equal(getFieldRule("general", "does.not.exist"), undefined);
  const title = getFieldRule("general", "overview.title");
  assert.ok(title);
  assert.equal(title?.required, "required");
  assert.equal(title?.belongsToStep, "basic");
});

test("isFieldVisible: hidden roots for cinema_event", () => {
  assert.equal(isFieldVisible("cinema_event", "itinerary.days"), false);
  assert.equal(isFieldVisible("cinema_event", "participation.requiredFitnessLevel"), false);
  assert.equal(isFieldVisible("cinema_event", "logistics.primaryTransportMode"), true);
  // basic_info stays visible:
  assert.equal(isFieldVisible("cinema_event", "overview.title"), true);
});

test("isFieldVisible: urban_event also hides logistics", () => {
  assert.equal(isFieldVisible("urban_event", "logistics.primaryTransportMode"), false);
  assert.equal(isFieldVisible("urban_event", "itinerary.days"), false);
  assert.equal(isFieldVisible("urban_event", "overview.title"), true);
});

test("isFieldRequiredAtLevel: autosave is always false", () => {
  for (const p of TOUR_FORM_PROFILE_VALUES) {
    assert.equal(isFieldRequiredAtLevel(p, "overview.title", "autosave"), false);
    assert.equal(isFieldRequiredAtLevel(p, "pricing.basePrice", "autosave"), false);
  }
});

test("isFieldRequiredAtLevel: hidden step makes required field effectively optional", () => {
  // urban_event hides logistics + capacity + itinerary + participation.
  assert.equal(isFieldRequiredAtLevel("urban_event", "logistics.primaryTransportMode", "submit"), false);
  assert.equal(isFieldRequiredAtLevel("urban_event", "itinerary.days", "submit"), false);
  // pricing.basePrice is intrinsically required but capacity step is hidden:
  assert.equal(isFieldRequiredAtLevel("urban_event", "pricing.basePrice", "submit"), false);
});

test("isFieldRequiredAtLevel: active profile sees required-ness on submit", () => {
  assert.equal(isFieldRequiredAtLevel("general", "overview.title", "submit"), true);
  assert.equal(isFieldRequiredAtLevel("general", "pricing.basePrice", "submit"), true);
  assert.equal(isFieldRequiredAtLevel("general", "itinerary.days", "submit"), true);
  assert.equal(isFieldRequiredAtLevel("general", "logistics.primaryTransportMode", "submit"), true);
});

test("isFieldRequiredAtLevel stepNav: relaxed before the user reaches the step", () => {
  // On step "basic" of general, logistics.primaryTransportMode is required at submit but
  // not at stepNav (replaces position-aware relaxLogisticsPrimary in legacy code).
  const visible = ["basic", "theme", "capacity", "location", "itinerary", "participation", "logistics", "policies", "review"] as const;
  assert.equal(
    isFieldRequiredAtLevel("general", "logistics.primaryTransportMode", "stepNav", "basic", visible),
    false,
  );
  assert.equal(
    isFieldRequiredAtLevel("general", "logistics.primaryTransportMode", "stepNav", "logistics", visible),
    true,
  );
});

test("getStepRule reflects rail visibility for the special capacity-redundant profiles", () => {
  assert.equal(getStepRule("urban_event", "capacity")?.visibility, "hidden");
  assert.equal(getStepRule("cinema_event", "capacity")?.visibility, "hidden");
  assert.equal(getStepRule("general", "capacity")?.visibility, "visible");
});

test("getStepRules: basic step aggregates every FieldRule with belongsToStep === basic", () => {
  const sr = getStepRules("general", "basic");
  assert.equal(sr.profile, "general");
  assert.equal(sr.stepId, "basic");
  assert.equal(sr.step?.stepId, "basic");
  assert.equal(sr.step?.visibility, "visible");
  const paths = sr.fields.map((f) => f.path);
  assert.deepEqual(paths, [...paths].sort((a, b) => a.localeCompare(b)));
  assert.ok(paths.includes("overview.title"));
  assert.ok(paths.includes("overview.tourType"));
  assert.equal(paths.length, 9);
});

/* ---------------------------------------------------------------------------------------------
 * Invariant I-3: every field that lives in an inactive group for a profile MUST be
 * `visibility: "hidden"` and MUST NOT be reported as required at submit. Cross-product sweep —
 * catches any future rule that flags `required: "required"` while staying in an inactive group.
 * ------------------------------------------------------------------------------------------- */
test("I-3: every field in an inactive group is hidden and not required at submit (cross-product sweep)", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const inactive = getInactiveFieldGroupsForProfile(profile);
    if (inactive.size === 0) continue;
    const rules = getProfileRules(profile);
    for (const rule of rules.fields.values()) {
      if (rule.belongsToGroup === "always") continue;
      if (!inactive.has(rule.belongsToGroup)) continue;
      assert.equal(
        rule.visibility,
        "hidden",
        `${profile}: field ${rule.path} belongs to inactive group ${rule.belongsToGroup} but visibility is ${rule.visibility}`,
      );
      assert.equal(
        isFieldRequiredAtLevel(profile, rule.path, "submit"),
        false,
        `${profile}: field ${rule.path} is required at submit but its group ${rule.belongsToGroup} is inactive`,
      );
    }
  }
});

/* ---------------------------------------------------------------------------------------------
 * Invariant I-3 corollary: a field requested at any visible step CAN be required at submit; a
 * hidden step's field MUST NOT be required. This is the dual of the sweep above, anchored at
 * the step level.
 * ------------------------------------------------------------------------------------------- */
test("I-3 corollary: hidden step's required fields are never enforced at submit", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const rules = getProfileRules(profile);
    for (const [stepId, stepRule] of rules.steps.entries()) {
      if (stepRule.visibility !== "hidden") continue;
      const stepFields = [...rules.fields.values()].filter((r) => r.belongsToStep === stepId);
      for (const rule of stepFields) {
        assert.equal(
          isFieldRequiredAtLevel(profile, rule.path, "submit"),
          false,
          `${profile}/${stepId}: ${rule.path} is enforced even though step is hidden`,
        );
      }
    }
  }
});

/* ---------------------------------------------------------------------------------------------
 * Invariant I-4: autosave never reports a required-field error for any field on any profile.
 * The shape/type-only contract MUST hold across the full rules table.
 * ------------------------------------------------------------------------------------------- */
test("I-4: every field is non-required at autosave on every profile (cross-product sweep)", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const rules = getProfileRules(profile);
    for (const rule of rules.fields.values()) {
      assert.equal(
        isFieldRequiredAtLevel(profile, rule.path, "autosave"),
        false,
        `${profile}: ${rule.path} is required at autosave (must always be optional at autosave)`,
      );
    }
  }
});

/* ---------------------------------------------------------------------------------------------
 * Phase P12 (promptq.md tail) — `"recommended"` tier folding.
 *
 * Pin the descriptor → wizard-rule contract so the Edit-side `recommended` preset rows always
 * propagate into the wizard rules layer, and the tier is fully non-blocking across all three
 * validation levels.
 * ------------------------------------------------------------------------------------------- */
test("P12: descriptor `recommended` preset rows propagate into wizard rules for paths in BASE_FIELD_RULES", () => {
  const basePaths = new Set(__INTERNAL_RULES__.BASE_FIELD_RULES.map((r) => r.path));
  let recommendedCount = 0;
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const presets = getTourFormProfileDescriptor(profile).edit.tripDetailsPresetOverrides;
    for (const preset of presets) {
      if (!basePaths.has(preset.id)) continue;
      if (preset.requiredness !== "recommended") continue;
      recommendedCount++;
      const rule = getFieldRule(profile, preset.id);
      assert.ok(rule, `${profile}: missing wizard rule for ${preset.id}`);
      assert.equal(
        rule.required,
        "recommended",
        `${profile}: wizard rule for ${preset.id} is "${rule.required}" but descriptor preset says "recommended"`,
      );
    }
  }
  // Sanity: at least one mountain_outdoor row mirrors into wizard rules (today: 4 rows —
  // transportationNotes, returnDate, groupSizeMin, groupSizeMax). The check guards against a
  // future descriptor refactor silently zeroing out the propagation pipeline.
  assert.ok(
    recommendedCount >= 4,
    `expected at least 4 "recommended" preset rows to propagate into wizard rules, saw ${recommendedCount}`,
  );
});

test("P12: `recommended` rules are non-blocking at every validation level (cross-product sweep)", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const rules = getProfileRules(profile);
    for (const rule of rules.fields.values()) {
      if (rule.required !== "recommended") continue;
      for (const level of ["autosave", "stepNav", "submit"] as const) {
        assert.equal(
          isFieldRequiredAtLevel(profile, rule.path, level),
          false,
          `${profile}/${level}: ${rule.path} is "recommended" but blocked at ${level}`,
        );
      }
    }
  }
});

test("P12: isFieldRecommended mirrors rule.required === 'recommended' for visible fields", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const rules = getProfileRules(profile);
    for (const rule of rules.fields.values()) {
      const expected = rule.visibility !== "hidden" && rule.required === "recommended";
      assert.equal(
        isFieldRecommended(profile, rule.path),
        expected,
        `${profile}: isFieldRecommended disagrees for ${rule.path}`,
      );
    }
  }
});

/* ---------------------------------------------------------------------------------------------
 * Phase P13 (UI fold-in of the "recommended" tier).
 *
 * The wizard step components (`LogisticsStep`, `ParticipationStep`) read `isFieldRecommended`
 * for a known set of mountain-only paths and surface a non-blocking "پیشنهادی" badge on
 * `FormField`. These tests pin the exact (profile, path) tuples the step components rely on,
 * so a future descriptor refactor that drops one of the four paths from the recommended set
 * for `mountain_outdoor` (or that accidentally extends the tier to a different profile)
 * fails CI loudly instead of silently disabling the badge.
 * ------------------------------------------------------------------------------------------- */
const P13_WIRED_RECOMMENDED_PATHS = [
  "logistics.transportationNotes",
  "logistics.groupSizeMin",
  "logistics.groupSizeMax",
  "participation.technicalSkillRequired",
] as const;

test("P13: exactly mountain_outdoor flags the four UI-wired paths as 'recommended'", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const expected = profile === "mountain_outdoor";
    for (const path of P13_WIRED_RECOMMENDED_PATHS) {
      assert.equal(
        isFieldRecommended(profile, path),
        expected,
        `${profile}/${path}: expected isFieldRecommended === ${expected}`,
      );
    }
  }
});

test("P13: each UI-wired path is registered in BASE_FIELD_RULES (otherwise the badge can never render)", () => {
  const known = new Set(__INTERNAL_RULES__.BASE_FIELD_RULES.map((r) => r.path));
  for (const path of P13_WIRED_RECOMMENDED_PATHS) {
    assert.ok(
      known.has(path),
      `${path} is wired to <FormField recommendedLabel> in a step but missing from BASE_FIELD_RULES`,
    );
  }
});
