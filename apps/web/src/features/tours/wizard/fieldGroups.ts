import { getTourFormProfileDescriptor, type TourFormProfile } from "@repo/types";

import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";

import { buildTourCreateFormDefaultValues } from "./tourCreateFormDefaults";
import type { TourCreateWizardStepId } from "./stepConfig";
import { stepTriggerFields, wizardSteps } from "./stepConfig";

const THEME_STEP_ID = "theme" as const satisfies TourCreateWizardStepId;

/** Canonical field group ids (Phase 2 registry). @see docs/20-architecture/tour-wizard-field-groups.md */
export const FIELD_GROUP_IDS = [
  "basic_info",
  "pricing_capacity",
  "schedule_location",
  "itinerary",
  "participation",
  "logistics",
  "policies",
  "review",
] as const;

export type FieldGroupId = (typeof FIELD_GROUP_IDS)[number];

const ALL_GROUP_SET = new Set<FieldGroupId>(FIELD_GROUP_IDS);

/**
 * Top-level `TourCreateFormValues` keys owned by each group (for future strip-on-save / Zod omit).
 * `review` is UI-only and owns no exclusive roots.
 */
export const GROUP_TO_TOUR_CREATE_ROOT_KEYS = {
  basic_info: ["overview", "autoAcceptRegistrations"] as const satisfies readonly (keyof TourCreateFormValues)[],
  pricing_capacity: ["pricing"] as const satisfies readonly (keyof TourCreateFormValues)[],
  schedule_location: ["schedule", "location"] as const satisfies readonly (keyof TourCreateFormValues)[],
  itinerary: ["itinerary"] as const satisfies readonly (keyof TourCreateFormValues)[],
  participation: ["participation"] as const satisfies readonly (keyof TourCreateFormValues)[],
  logistics: ["logistics"] as const satisfies readonly (keyof TourCreateFormValues)[],
  policies: ["policies"] as const satisfies readonly (keyof TourCreateFormValues)[],
  review: [] as const satisfies readonly (keyof TourCreateFormValues)[],
} as const satisfies Record<FieldGroupId, readonly (keyof TourCreateFormValues)[]>;

/** Primary owning group per wizard step (used to derive hidden steps from inactive groups). */
export const STEP_PRIMARY_FIELD_GROUP: Record<TourCreateWizardStepId, FieldGroupId | null> = {
  basic: "basic_info",
  theme: "basic_info",
  capacity: "pricing_capacity",
  location: "schedule_location",
  itinerary: "itinerary",
  participation: "participation",
  logistics: "logistics",
  policies: "policies",
  /** Summary step is never removed by the v1 profile matrix. */
  review: null,
};

/**
 * Maps each {@link TourFormProfile} to wizard field groups that are inactive for that profile.
 *
 * **Phase P10 (promptq.md):** the per-profile table moved into the declarative descriptor at
 * `packages/types/src/tour-form-profile-descriptors.ts` (`inactiveFieldGroups`). This function
 * is now a thin lens that reads `getTourFormProfileDescriptor(profile).inactiveFieldGroups`
 * and narrows the result to the local {@link FieldGroupId} union. The `WizardFieldGroupSlug`
 * literals in `@repo/types` are shape-checked against {@link FIELD_GROUP_IDS} at runtime in
 * `fieldGroups.spec.ts` (`descriptor inactiveFieldGroups ⊆ FIELD_GROUP_IDS`) so the two stay in
 * lock-step.
 *
 * The wizard `profileRules` layer reads this table via `getInactiveFieldGroupsForProfile`;
 * `docs/20-architecture/tour-wizard-field-groups.md` §6 mirrors the human-readable matrix.
 */
export function getInactiveFieldGroupsForProfile(profile: TourFormProfile): ReadonlySet<FieldGroupId> {
  const { inactiveFieldGroups } = getTourFormProfileDescriptor(profile);
  if (inactiveFieldGroups.length === 0) {
    return new Set();
  }
  const out = new Set<FieldGroupId>();
  for (const slug of inactiveFieldGroups) {
    if (ALL_GROUP_SET.has(slug as FieldGroupId)) {
      out.add(slug as FieldGroupId);
    }
  }
  return out;
}

export function getActiveFieldGroupsForProfile(profile: TourFormProfile): ReadonlySet<FieldGroupId> {
  const inactive = getInactiveFieldGroupsForProfile(profile);
  return new Set([...ALL_GROUP_SET].filter((g) => !inactive.has(g)));
}

const CAPACITY_PRICING_ONLY_TRIGGER_PATHS: ReadonlySet<string> = new Set([
  "pricing.basePrice",
  "logistics.groupSizeMin",
  "logistics.groupSizeMax",
]);

/** Wizard steps hidden for this profile (derived from inactive groups + step primary ownership). */
export function getSkippedWizardStepsForProfile(profile: TourFormProfile): ReadonlySet<TourCreateWizardStepId> {
  const inactive = getInactiveFieldGroupsForProfile(profile);
  const skip = new Set<TourCreateWizardStepId>();
  for (const step of wizardSteps) {
    const g = STEP_PRIMARY_FIELD_GROUP[step];
    if (g != null && inactive.has(g)) {
      skip.add(step);
    }
  }
  return skip;
}

/** Top-level form keys to treat as inactive for strip / future Zod composition (Phase 4). */
export function inactiveTourCreateRootKeysForProfile(
  profile: TourFormProfile,
): readonly (keyof TourCreateFormValues)[] {
  const inactive = getInactiveFieldGroupsForProfile(profile);
  const out = new Set<keyof TourCreateFormValues>();
  for (const g of inactive) {
    for (const k of GROUP_TO_TOUR_CREATE_ROOT_KEYS[g]) {
      out.add(k);
    }
  }
  return [...out];
}

/**
 * Phase 4 — reset top-level form slices owned by **inactive** field groups to the canonical empty
 * wizard defaults so `mapFormValuesToBackendPayload` never sends ghost data from hidden steps
 * (e.g. cloned drafts or devtools).
 */
export function stripInactiveTourCreateGroupsForProfile(
  profile: TourFormProfile,
  values: TourCreateFormValues,
): TourCreateFormValues {
  const roots = inactiveTourCreateRootKeysForProfile(profile);
  if (roots.length === 0) {
    return values;
  }
  const template = buildTourCreateFormDefaultValues();
  let next: TourCreateFormValues = values;
  for (const root of roots) {
    if (root === "itinerary") {
      next = { ...next, itinerary: { days: [] } };
    } else {
      next = { ...next, [root]: template[root] };
    }
  }
  return next;
}

/**
 * Profile-aware sanitizer for the wizard auto-save & draft-restore paths.
 *
 * Identical contract to {@link stripInactiveTourCreateGroupsForProfile}
 * (which gates the submit path in `useTourWizardCreate`): every top-level
 * root owned by a field group marked inactive for `profile` is reset to its
 * canonical default from `buildTourCreateFormDefaultValues()`; active roots
 * are returned by reference.
 *
 * Exposed under a more ergonomic name + argument order (`values, profile`)
 * for read sites that pipe through React effects / serializers. Returning
 * the input value by reference for profiles with no inactive groups avoids
 * needless re-renders in those effects.
 *
 * Used by:
 *   - the auto-save effect in `TourCreateWizard.tsx` (sanitizes the
 *     `watched` snapshot before `serializeWizardDraft` so `tour-create-
 *     wizard-draft-v1` never persists ghost data after a profile flip);
 *   - the draft-restore effect in `TourCreateWizard.tsx` (belt-and-
 *     suspenders re-strip after `mergeTourDraft`, even though
 *     `filterFormPatchByActiveGroups` already trimmed the incoming patch).
 */
export function sanitizeInactiveRootsForProfile(
  values: TourCreateFormValues,
  profile: TourFormProfile,
): TourCreateFormValues {
  return stripInactiveTourCreateGroupsForProfile(profile, values);
}

/**
 * **Profile-aware preload filter.**
 *
 * Drops top-level form roots owned by **inactive** field groups from a wizard-shaped patch
 * (presets `defaults` JSON, clone-transformed tour, restored localStorage draft) *before* it is
 * merged into the live form via {@link mergeTourDraft}.
 *
 * Why this exists:
 * - {@link stripInactiveTourCreateGroupsForProfile} guarantees the **API payload** never contains
 *   inactive-group data (called from `useTourWizardCreate` at submit time), aligning with the
 *   server-side profile strip in `apps/api/src/modules/tours/utils/create-tour-form-profile-strip.ts`.
 * - But preload (preset apply + clone/draft restore) goes through {@link mergeTourDraft}, which is
 *   profile-blind. That meant inactive-group data could leak into RHF state and the localStorage
 *   auto-save even though the wizard never rendered those fields.
 * - Applying this filter at the merge boundary makes preload symmetric with submit-time strip:
 *   the same roots are gated everywhere the wizard touches them.
 *
 * Behavior:
 * - `patch === undefined` returns `undefined` (so callers can keep passing it to {@link mergeTourDraft}
 *   which already handles `undefined`).
 * - When the profile has no inactive groups (e.g. `"general"`, `"mountain_outdoor"`, `"nature_trip"`,
 *   `"cultural_tour"`), the patch is returned **as-is** by reference — zero overhead.
 * - For `"cinema_event"` / `"urban_event"` (and any future profile that returns a non-empty
 *   {@link inactiveTourCreateRootKeysForProfile}), a shallow copy is returned with the inactive
 *   root keys deleted. The remaining root values are not deep-cloned — callers must treat the
 *   result as a fresh `Partial` they can mutate, same contract as before.
 */
export function filterFormPatchByActiveGroups(
  profile: TourFormProfile,
  patch: Partial<TourCreateFormValues> | undefined,
): Partial<TourCreateFormValues> | undefined {
  if (!patch) return patch;
  const inactiveRoots = inactiveTourCreateRootKeysForProfile(profile);
  if (inactiveRoots.length === 0) return patch;
  const next: Partial<TourCreateFormValues> = { ...patch };
  for (const root of inactiveRoots) {
    delete next[root];
  }
  return next;
}

const TOUR_CREATE_FORM_ROOT_KEYS = new Set<keyof TourCreateFormValues>([
  "autoAcceptRegistrations",
  "overview",
  "pricing",
  "schedule",
  "location",
  "itinerary",
  "participation",
  "logistics",
  "policies",
]);

/** First segment of an RHF path → top-level `TourCreateFormValues` key (when known). */
export function tourCreateRootKeyFromTriggerPath(
  path: keyof TourCreateFormValues | string,
): keyof TourCreateFormValues | null {
  const raw = typeof path === "string" ? path : String(path);
  const top = raw.split(".")[0];
  if (!top) return null;
  if (!TOUR_CREATE_FORM_ROOT_KEYS.has(top as keyof TourCreateFormValues)) {
    return null;
  }
  return top as keyof TourCreateFormValues;
}

/**
 * True when every `stepTriggerFields[step]` path resolves to a **inactive** top-level form root.
 * Used to drop legacy steps that would otherwise show an empty shell once inactive groups no longer
 * contribute fields (Phase 3 dynamic skip; complements primary-group skip).
 */
export function isWizardStepRedundantForInactiveTourRoots(
  step: TourCreateWizardStepId,
  inactiveRoots: ReadonlySet<keyof TourCreateFormValues>,
): boolean {
  const fields = stepTriggerFields[step];
  if (fields.length === 0) {
    return false;
  }
  for (const p of fields) {
    const root = tourCreateRootKeyFromTriggerPath(p);
    if (root == null || !inactiveRoots.has(root)) {
      return false;
    }
  }
  return true;
}

/**
 * True when a step's `stepTriggerFields` do not correspond to any mounted controls for the profile.
 * v1 case: `capacity` only validates `pricing.basePrice` + legacy `logistics.groupSize*`, but the UI moved
 * auto-accept + base price concerns into other steps for urban/cinema profiles — leaving an empty shell.
 *
 * **Phase P10+ housekeeping:** the urban/cinema branch is read from
 * `getTourFormProfileDescriptor(profile).wizardCapacityStepRedundant` in `@repo/types`.
 */
export function isWizardStepRedundantForProfile(step: TourCreateWizardStepId, profile: TourFormProfile): boolean {
  if (step !== "capacity") {
    return false;
  }
  if (!getTourFormProfileDescriptor(profile).wizardCapacityStepRedundant) {
    return false;
  }
  const fields = stepTriggerFields[step];
  if (fields.length === 0) {
    return false;
  }
  for (const p of fields) {
    const raw = typeof p === "string" ? p : String(p);
    if (!CAPACITY_PRICING_ONLY_TRIGGER_PATHS.has(raw)) {
      return false;
    }
  }
  return true;
}

/**
 * Ordered wizard step ids: profile primary-group skip, then drop steps whose **entire** trigger set
 * lies under inactive tour-create roots (future-proof for new profiles / trigger edits).
 */
export function getVisibleWizardStepsForProfile(profile: TourFormProfile): TourCreateWizardStepId[] {
  const skip = getSkippedWizardStepsForProfile(profile);
  const inactiveRoots = new Set(inactiveTourCreateRootKeysForProfile(profile));
  return wizardSteps.filter((s) => {
    if (skip.has(s)) {
      return false;
    }
    if (isWizardStepRedundantForProfile(s, profile)) {
      return false;
    }
    if (isWizardStepRedundantForInactiveTourRoots(s, inactiveRoots)) {
      return false;
    }
    return true;
  });
}

/**
 * When the workspace catalog has **no active** tour themes, skip the dedicated theme shell
 * so staff are not sent to an empty step (Phase 3 «skip empty page» for this rail only).
 */
export function pruneWizardStepsWithoutActiveThemes(
  steps: readonly TourCreateWizardStepId[],
  opts: { themesQueryFinishedLoading: boolean; activeThemeCount: number },
): TourCreateWizardStepId[] {
  if (opts.themesQueryFinishedLoading && opts.activeThemeCount === 0) {
    return steps.filter((s) => s !== THEME_STEP_ID);
  }
  return [...steps];
}
