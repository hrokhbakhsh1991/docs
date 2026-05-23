import {
  TOUR_FORM_PROFILE_VALUES,
  getTourFormProfileDescriptor,
  type TourFormProfile,
} from "@repo/types";

import {
  STEP_PRIMARY_FIELD_GROUP,
  getInactiveFieldGroupsForProfile,
  isWizardStepRedundantForProfile,
  type FieldGroupId,
} from "@/features/tours/wizard/fieldGroups";
import {
  stepTitlesFa,
  stepTriggerFields,
  wizardSteps,
  type TourCreateWizardStepId,
} from "@/features/tours/wizard/stepConfig";

import type {
  FieldRequiredness,
  FieldRule,
  ProfileRules,
  StepRule,
  WizardFieldPath,
} from "./types";

/* ============================================================================================
 * RECIPE — adding a new wizard field
 * ============================================================================================
 *
 * 1. Add a row to `BASE_FIELD_RULES` below:
 *
 *      fieldRule("logistics.newField", {
 *        required: "required",          // omit for optional fields
 *        step: "logistics",              // which wizard step owns the field
 *        group: "logistics",             // which field group it belongs to
 *      }),
 *
 *    The visibility per `TourFormProfile` is derived automatically from the field group's
 *    activeness in `apps/web/src/features/tours/wizard/fieldGroups.ts:getInactiveFieldGroupsForProfile`.
 *    The parity spec `parity-with-server.spec.ts` will fail if a new field's group leaks past
 *    the server-side `URBAN_LOGISTICS_WHITELIST_KEYS` strip; update both sides together.
 *
 * 2. Render the field in its step component using `useFieldRule(path)`:
 *
 *      const rule = useFieldRule("logistics.newField");
 *      if (!rule.visible) return null;
 *      <FormField required={rule.required === "required"} ... />
 *
 *    Do NOT branch on `TourFormProfile` literals inline. Behavior comes from `FieldRule`.
 *
 * 3. If the new field is required, mirror the Persian error message in
 *    `apps/web/src/features/tours/wizard/profileRules/validation.ts:REQUIRED_MESSAGES`.
 *
 * 4. Add the field to the Zod schema (`tourCreateSchema.ts`) ONLY if it needs shape/type
 *    validation. Required-ness comes from this rules table; the Zod schema's job is
 *    structural correctness, not policy.
 *
 * 5. Run `pnpm --filter @apps/web eslint` and the wizard test suite. The rules-layer
 *    parity tests (`profileRules.spec.ts`, `parity-with-server.spec.ts`) will catch
 *    inconsistencies automatically.
 *
 * **Forbidden in wizard code (enforced by ESLint, see `apps/web/.eslintrc.json` overrides):**
 *
 *   - importing `EventKind` / `resolveEventKindFromTourContext` / `eventKindForDomainProfile`
 *     from `@repo/types`;
 *   - importing `@/features/tours/config/tripDetailsFieldConfig`.
 *
 * See `docs/20-architecture/tour-profile-guardrails.md` for the full guardrail set.
 * ============================================================================================
 */

/**
 * Master flat list of field rules — the "general" baseline. Every field that appears in any
 * wizard step is enumerated here exactly once. Per-profile rules are derived from this list
 * in {@link buildProfileRules} by toggling `visibility` for fields whose owning group is
 * inactive for that profile.
 *
 * NOTE on direction of truth: This list is the **canonical** declarative source for
 * wizard field visibility + required-ness. The Zod schema in `tourCreateSchema.ts` currently
 * mirrors it for the enforcement path (see `profileRules/validation.spec.ts` for parity
 * tests). Longer term, codegen could derive Zod required-ness from this table so the two
 * cannot drift; until then, change the schema and `BASE_FIELD_RULES` together when required-ness
 * moves.
 *
 * If you add a new wizard field, add a corresponding entry here so the rules layer stays
 * complete — the "base rules cover every stepTriggerFields path" guard in
 * `profileRules.spec.ts` will flag missing entries during tests.
 */
const BASE_FIELD_RULES: readonly FieldRule[] = [
  // ------------------------------------------------------------- basic_info / step: basic
  fieldRule("overview.title", { required: "required", step: "basic", group: "basic_info" }),
  fieldRule("overview.tourType", { step: "basic", group: "basic_info" }),
  fieldRule("overview.shortDescription", { step: "basic", group: "basic_info" }),
  fieldRule("overview.longDescription", { step: "basic", group: "basic_info" }),
  fieldRule("overview.communicationLink", { step: "basic", group: "basic_info" }),
  fieldRule("overview.tripStyles", { step: "basic", group: "basic_info" }),
  fieldRule("overview.highlights", { step: "basic", group: "basic_info" }),
  fieldRule("overview.slug", { step: "basic", group: "basic_info" }),
  fieldRule("overview.locationSummary", { step: "basic", group: "basic_info" }),
  fieldRule("autoAcceptRegistrations", { step: "capacity", group: "basic_info" }),

  // ------------------------------------------------------------- basic_info / step: theme
  fieldRule("overview.mainTourThemeId", { step: "theme", group: "basic_info" }),
  fieldRule("overview.secondaryTourThemeIds", { step: "theme", group: "basic_info" }),

  // ------------------------------------------------------------- pricing_capacity
  fieldRule("pricing.basePrice", { required: "required", step: "capacity", group: "pricing_capacity" }),
  fieldRule("pricing.currency", { step: "capacity", group: "pricing_capacity" }),
  fieldRule("pricing.discountNotes", { step: "capacity", group: "pricing_capacity" }),

  // ------------------------------------------------------------- schedule_location
  fieldRule("schedule.startDate", { step: "location", group: "schedule_location" }),
  fieldRule("schedule.endDate", { step: "location", group: "schedule_location" }),
  /** @deprecated Favor logistics.gatheringPoints stations. */
  fieldRule("schedule.departureMeetingTime", { step: "location", group: "schedule_location", visibility: "hidden" }),
  /** @deprecated Favor logistics.gatheringPoints stations. */
  fieldRule("schedule.returnMeetingTime", { step: "location", group: "schedule_location", visibility: "hidden" }),
  fieldRule("location.regionId", { step: "location", group: "schedule_location" }),
  fieldRule("location.mainDestinationId", { step: "location", group: "schedule_location" }),
  fieldRule("location.secondaryDestinationIds", { step: "location", group: "schedule_location" }),
  /** @deprecated Favor logistics.gatheringPoints stations. */
  fieldRule("location.meetingPoint", { step: "location", group: "schedule_location", visibility: "hidden" }),
  /** @deprecated Favor logistics.gatheringPoints stations. */
  fieldRule("location.returnPoint", { step: "location", group: "schedule_location", visibility: "hidden" }),
  fieldRule("location.displayLocation", { step: "location", group: "schedule_location" }),

  // ------------------------------------------------------------- itinerary
  fieldRule("itinerary.days", { required: "required", step: "itinerary", group: "itinerary" }),

  // ------------------------------------------------------------- participation
  ...participationKeys().map((k) =>
    fieldRule(`participation.${k}`, { step: "participation", group: "participation" }),
  ),

  // ------------------------------------------------------------- logistics
  fieldRule("logistics.primaryTransportMode", { required: "required", step: "logistics", group: "logistics" }),
  fieldRule("logistics.gatheringPoints", { step: "logistics", group: "logistics" }),
  ...logisticsKeys().map((k) =>
    fieldRule(`logistics.${k}`, {
      step: "logistics",
      group: "logistics",
      visibility: k === "meetingPointDetails" ? "hidden" : "active",
    }),
  ),
  // legacy: group-size lives on the logistics root but is edited via the `capacity` step.
  fieldRule("logistics.groupSizeMin", { step: "capacity", group: "logistics" }),
  fieldRule("logistics.groupSizeMax", { step: "capacity", group: "logistics" }),

  // ------------------------------------------------------------- policies
  ...policiesKeys().map((k) =>
    fieldRule(`policies.${k}`, { step: "policies", group: "policies" }),
  ),
];

function fieldRule(
  path: string,
  opts: {
    required?: FieldRule["required"];
    visibility?: FieldRule["visibility"];
    step: TourCreateWizardStepId;
    group: FieldRule["belongsToGroup"];
  },
): FieldRule {
  return {
    path: path as WizardFieldPath,
    visibility: opts.visibility ?? "active",
    required: opts.required ?? "optional",
    belongsToStep: opts.step,
    belongsToGroup: opts.group,
  };
}

function participationKeys() {
  return [
    "requiredExperienceLevel",
    "requiredFitnessLevel",
    "minimumAge",
    "maximumAge",
    "genderRestriction",
    "technicalSkillRequired",
    "medicalRestrictions",
    "requirements",
    "skillsRequired",
    "gearRequiredIds",
    "gearOptionalIds",
    "documentsRequired",
    "suitableFor",
    "notSuitableFor",
    "sportsInsuranceRequired",
    "registrationNationalIdRequired",
    "minParticipants",
  ] as const;
}

function logisticsKeys() {
  return [
    "supplementalPrivateCar",
    "fuelShareToman",
    "includedServices",
    "excludedServices",
    "meetingPointDetails",
    "transportationDetails",
    "accommodationDetails",
    "transportationNotes",
    "accommodationTypes",
    "accommodationNotes",
    "mealPlan",
    "mealNotes",
    "supportServices",
    "optionalServices",
    "leaderProvidesInsurance",
    "leaderInsuranceNotes",
    "guideLanguageIds",
  ] as const;
}

function policiesKeys() {
  return [
    "cancellationPolicy",
    "refundPolicy",
    "safetyNotes",
    "riskDisclaimer",
    "attendanceRules",
    "lateArrivalPolicy",
    "noShowPolicy",
    "confirmationPolicy",
    "capacityPolicy",
    "safetyPolicy",
    "weatherPolicy",
    "reservationRules",
  ] as const;
}

/**
 * Phase P10 (promptq.md): display keys are now sourced from the declarative descriptor
 * (`packages/types/src/tour-form-profile-descriptors.ts:displayKeyFa`). The descriptor's
 * parity spec pins the `tours.profiles.<slug>` shape, so this map cannot drift from i18n.
 */
const PROFILE_DISPLAY_KEYS: Record<TourFormProfile, string> = (() => {
  const out = {} as Record<TourFormProfile, string>;
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    out[profile] = getTourFormProfileDescriptor(profile).displayKeyFa;
  }
  return out;
})();

function buildStepRulesForProfile(
  profile: TourFormProfile,
  inactiveGroups: ReadonlySet<FieldGroupId>,
): ReadonlyMap<TourCreateWizardStepId, StepRule> {
  const entries: Array<readonly [TourCreateWizardStepId, StepRule]> = wizardSteps.map((stepId) => {
    const primaryGroup = STEP_PRIMARY_FIELD_GROUP[stepId];
    const inactiveByGroup = primaryGroup != null && inactiveGroups.has(primaryGroup);
    // Delegate "this step has no fields to render for this profile" to the existing
    // `fieldGroups.ts` helper. Keeping the data in one place avoids two-way drift the
    // moment any future profile/step redundancy rule is added.
    const stepRedundant = isWizardStepRedundantForProfile(stepId, profile);
    const visibility: StepRule["visibility"] =
      inactiveByGroup || stepRedundant ? "hidden" : "visible";
    const rule: StepRule = {
      stepId,
      visibility,
      titleFa: stepTitlesFa[stepId],
      stepNavTriggers: stepTriggerFields[stepId].map((p) => String(p) as WizardFieldPath),
    };
    return [stepId, rule] as const;
  });
  return new Map(entries);
}

/**
 * Phase P12 (promptq.md tail) — per-profile **non-blocking** required-ness overrides derived
 * from the declarative descriptor's `edit.tripDetailsPresetOverrides`. The descriptor is the
 * single source of truth; this map is the wizard's *application* of it.
 *
 * Scope (intentionally narrow to avoid a behavioral break):
 *
 * - Only `"recommended"` preset rows propagate from the descriptor into wizard rules. The
 *   `"recommended"` tier is non-blocking at every validation level
 *   (see {@link isFieldRequiredAtLevel}), so submit / stepNav behavior is **byte-identical**
 *   to the pre-P12 state. The tier is wired purely so consumers (Edit row config, future
 *   wizard UI hints) can read it from the same canonical surface as every other field rule.
 *
 * - Preset rows tagged `"required"` are **deliberately not** mirrored here yet — promoting
 *   a field from `BASE_FIELD_RULES.required === "optional"` to `"required"` for one profile
 *   would change submit behavior and falls under a separate, opt-in migration step that
 *   needs UX sign-off (see `docs/20-architecture/ADR-tour-profile-closure.md`, "Optional
 *   follow-ups"). Today the Edit adapter still reads those rows from
 *   `tripDetailsFieldConfig.ts` directly.
 *
 * - Only paths that **also** appear in {@link BASE_FIELD_RULES} are picked up here — paths
 *   that are Edit-only (e.g. `participation.documentsRequired`, `overview.maxAltitudeMeters`)
 *   stay in `apps/web/src/features/tours/config/tripDetailsFieldConfig.ts` until they are
 *   registered in the wizard rules table too.
 *
 * Parity is pinned by `profileRules/profileRules.spec.ts` (the "P12: descriptor `recommended`
 * preset rows propagate" sweep).
 */
const BASE_FIELD_PATHS = new Set<string>(BASE_FIELD_RULES.map((r) => r.path));

const PROFILE_FIELD_REQUIRED_OVERRIDES: Record<TourFormProfile, ReadonlyMap<string, FieldRequiredness>> =
  (() => {
    const out = {} as Record<TourFormProfile, ReadonlyMap<string, FieldRequiredness>>;
    for (const profile of TOUR_FORM_PROFILE_VALUES) {
      const desc = getTourFormProfileDescriptor(profile);
      const map = new Map<string, FieldRequiredness>();
      for (const preset of desc.edit.tripDetailsPresetOverrides) {
        if (!BASE_FIELD_PATHS.has(preset.id)) continue;
        if (preset.requiredness !== "recommended") continue;
        map.set(preset.id, "recommended");
      }
      out[profile] = map;
    }
    return out;
  })();

function buildFieldRulesForProfile(
  profile: TourFormProfile,
  inactiveGroups: ReadonlySet<FieldGroupId>,
): ReadonlyMap<WizardFieldPath, FieldRule> {
  const overrides = PROFILE_FIELD_REQUIRED_OVERRIDES[profile];
  const entries = BASE_FIELD_RULES.map((rule) => {
    const groupHidden =
      rule.belongsToGroup !== "always" && inactiveGroups.has(rule.belongsToGroup);
    const overriddenRequired = overrides.get(rule.path);
    const next: FieldRule = {
      ...rule,
      visibility: groupHidden ? "hidden" : rule.visibility,
      required: overriddenRequired ?? rule.required,
    };
    return [rule.path, next] as const;
  });
  return new Map(entries);
}

function buildProfileRules(profile: TourFormProfile): ProfileRules {
  const inactiveGroups = getInactiveFieldGroupsForProfile(profile);
  return {
    profile,
    meta: { profile, displayKey: PROFILE_DISPLAY_KEYS[profile] },
    steps: buildStepRulesForProfile(profile, inactiveGroups),
    fields: buildFieldRulesForProfile(profile, inactiveGroups),
  };
}

const PROFILE_RULES_CACHE = new Map<TourFormProfile, ProfileRules>();

export function getCachedProfileRules(profile: TourFormProfile): ProfileRules {
  let cached = PROFILE_RULES_CACHE.get(profile);
  if (cached == null) {
    cached = buildProfileRules(profile);
    PROFILE_RULES_CACHE.set(profile, cached);
  }
  return cached;
}

/** Wizard-wide iteration order — identical to {@link TOUR_FORM_PROFILE_VALUES} in `@repo/types`. */
export const ALL_PROFILES: readonly TourFormProfile[] = TOUR_FORM_PROFILE_VALUES;

/**
 * Internal handles exposed for parity/coverage tests only. Not part of the public API.
 */
export const __INTERNAL_RULES__ = {
  BASE_FIELD_RULES,
} as const;
