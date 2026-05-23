import type { TourFormProfile } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import type { FieldGroupId } from "@/features/tours/wizard/fieldGroups";
import type { TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";

import { ALL_PROFILES, getCachedProfileRules } from "./rules";
import type {
  FieldRule,
  ProfileRules,
  StepRule,
  StepRules,
  ValidationLevel,
  WizardFieldPath,
} from "./types";

/** Memoized rules table for a single profile. */
export function getProfileRules(profile: TourFormProfile): ProfileRules {
  return getCachedProfileRules(profile);
}

export function listAllProfileRules(): readonly ProfileRules[] {
  return ALL_PROFILES.map(getProfileRules);
}

export function getFieldRule(
  profile: TourFormProfile,
  path: WizardFieldPath | string,
): FieldRule | undefined {
  return getProfileRules(profile).fields.get(path as WizardFieldPath);
}

export function getStepRule(
  profile: TourFormProfile,
  stepId: TourCreateWizardStepId,
): StepRule | undefined {
  return getProfileRules(profile).steps.get(stepId);
}

/**
 * All rules scoped to a single wizard step for the given profile: step rail metadata plus every
 * field whose `belongsToStep` equals `stepId`. Prefer this over re-filtering `ProfileRules.fields`
 * in consumers.
 */
export function getStepRules(
  profile: TourFormProfile,
  stepId: TourCreateWizardStepId,
): StepRules {
  const rules = getProfileRules(profile);
  const step = rules.steps.get(stepId);
  const fields = [...rules.fields.values()]
    .filter((f) => f.belongsToStep === stepId)
    .sort((a, b) => a.path.localeCompare(b.path));
  return { profile, stepId, step, fields };
}

/** Ordered visible step ids — parity with `getVisibleWizardStepsForProfile`. */
export function getVisibleStepIds(
  profile: TourFormProfile,
): readonly TourCreateWizardStepId[] {
  const rules = getProfileRules(profile);
  return [...rules.steps.values()]
    .filter((s) => s.visibility === "visible")
    .map((s) => s.stepId);
}

/** True when the field's derived rule is not `"hidden"`. Defaults to `false` for unknown paths. */
export function isFieldVisible(
  profile: TourFormProfile,
  path: WizardFieldPath | string,
): boolean {
  const rule = getFieldRule(profile, path);
  if (!rule) return false;
  return rule.visibility !== "hidden";
}

/**
 * True when the field's derived rule marks it as `"recommended"` for the given profile.
 *
 * `"recommended"` is non-blocking at every validation level (see {@link isFieldRequiredAtLevel})
 * and exists purely so the UI can render a "recommended" hint / badge alongside the field.
 * Unknown paths return `false`.
 */
export function isFieldRecommended(
  profile: TourFormProfile,
  path: WizardFieldPath | string,
): boolean {
  const rule = getFieldRule(profile, path);
  if (!rule) return false;
  if (rule.visibility === "hidden") return false;
  return rule.required === "recommended";
}

const TOUR_CREATE_ROOT_KEYS: readonly (keyof TourCreateFormValues)[] = [
  "autoAcceptRegistrations",
  "overview",
  "pricing",
  "schedule",
  "location",
  "itinerary",
  "participation",
  "logistics",
  "policies",
];

function rootKeyFromPath(path: string): keyof TourCreateFormValues | null {
  const top = path.split(".")[0];
  if (!top) return null;
  return (TOUR_CREATE_ROOT_KEYS as readonly string[]).includes(top)
    ? (top as keyof TourCreateFormValues)
    : null;
}

/**
 * Top-level form roots that contain **only** hidden fields for the profile. Parity target:
 * `inactiveTourCreateRootKeysForProfile` in `fieldGroups.ts`.
 *
 * We intentionally require *all* known fields under a root to be hidden before flagging the
 * root as inactive — this keeps `overview` from accidentally being marked inactive when
 * a future profile hides a single overview field but not the whole group.
 */
export function getInactiveRootKeys(
  profile: TourFormProfile,
): readonly (keyof TourCreateFormValues)[] {
  const rules = getProfileRules(profile);
  const candidateRoots = new Set<keyof TourCreateFormValues>();
  for (const rule of rules.fields.values()) {
    if (rule.visibility !== "hidden") continue;
    const root = rootKeyFromPath(rule.path);
    if (root != null) candidateRoots.add(root);
  }
  const out: (keyof TourCreateFormValues)[] = [];
  for (const root of candidateRoots) {
    let allHidden = true;
    for (const rule of rules.fields.values()) {
      if (rootKeyFromPath(rule.path) !== root) continue;
      if (rule.visibility !== "hidden") {
        allHidden = false;
        break;
      }
    }
    if (allHidden) out.push(root);
  }
  return out;
}

export function getInactiveFieldGroups(
  profile: TourFormProfile,
): readonly FieldGroupId[] {
  const rules = getProfileRules(profile);
  const activeGroups = new Set<FieldGroupId>();
  const inactiveGroups = new Set<FieldGroupId>();

  for (const rule of rules.fields.values()) {
    if (rule.belongsToGroup === "always") continue;
    if (rule.visibility !== "hidden") {
      activeGroups.add(rule.belongsToGroup);
    } else {
      inactiveGroups.add(rule.belongsToGroup);
    }
  }

  const out: FieldGroupId[] = [];
  for (const g of inactiveGroups) {
    if (!activeGroups.has(g)) {
      out.push(g);
    }
  }
  return out;
}

/**
 * Effective required-ness at a given validation level.
 *
 * Rules:
 * - `"autosave"` → never required (shape-only).
 * - Field not in rules table, or `required !== "required"` → not required.
 *   In particular `required === "recommended"` returns **false** at every level — the tier
 *   is a non-blocking UI hint only (see {@link FieldRequiredness}).
 * - Field is hidden → not required (defensive; mirrors "ghost data is never enforced").
 * - Field's owning step is hidden → not required (this replaces the legacy
 *   `relaxItineraryMinDays` / `relaxLogisticsPrimary` runtime flags).
 * - `"submit"` → required when all of the above pass.
 * - `"stepNav"` → required only when the user has reached or passed the field's owning step
 *   (so the wizard does not fail a stepNav guard on a field the user has not seen yet).
 *
 * When `cursor` / `visibleSteps` are omitted at `"stepNav"`, we fall back to "required = true"
 * (callers should pass the cursor; this default matches the legacy schema's behavior at
 * submit time, which is the safe upper bound).
 */
export function isFieldRequiredAtLevelFromRules(
  rules: ProfileRules,
  path: WizardFieldPath | string,
  level: ValidationLevel,
  cursor?: TourCreateWizardStepId,
  visibleSteps?: readonly TourCreateWizardStepId[],
): boolean {
  if (level === "autosave") return false;
  const rule = rules.fields.get(path as WizardFieldPath);
  if (!rule || rule.required !== "required") return false;
  if (rule.visibility === "hidden") return false;

  const step = rules.steps.get(rule.belongsToStep);
  if (!step || step.visibility === "hidden") return false;

  if (level === "submit") return true;

  if (cursor == null || !visibleSteps) return true;
  const cursorIdx = visibleSteps.indexOf(cursor);
  const fieldIdx = visibleSteps.indexOf(rule.belongsToStep);
  if (cursorIdx === -1 || fieldIdx === -1) return true;
  return fieldIdx <= cursorIdx;
}

export function isFieldRequiredAtLevel(
  profile: TourFormProfile,
  path: WizardFieldPath | string,
  level: ValidationLevel,
  cursor?: TourCreateWizardStepId,
  visibleSteps?: readonly TourCreateWizardStepId[],
): boolean {
  return isFieldRequiredAtLevelFromRules(
    getProfileRules(profile),
    path,
    level,
    cursor,
    visibleSteps,
  );
}
