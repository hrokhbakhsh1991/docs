import type { TourFormProfile, TourType } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/legacy/schemas/tourCreateSchema";
import type { TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";
import type { FieldGroupId } from "@/features/tours/wizard/fieldGroups";

/**
 * Single canonical Tour Creation Wizard profile-rules layer.
 *
 * This module is the **L1 / pure domain** layer of the design described in
 * `docs/.../prompt.md` ("Phase Design — Wizard-only Architecture for TourFormProfile as
 * Single Source of Truth"). It is consumed by:
 *
 * - L2 form glue (`profileRules/getProfileRules.ts` derived helpers).
 * - L3 React bindings under `profileRulesReact/`.
 *
 * No file under `profileRules/` may import React.
 */

/**
 * Dotted RHF path into `TourCreateFormValues`. We accept `string` for compatibility with
 * `stepTriggerFields` (also `string`-typed) and `react-hook-form`'s path API; the optional
 * brand documents intent without rejecting bare strings.
 */
export type WizardFieldPath = string & { readonly __brand?: "WizardFieldPath" };

/**
 * Intrinsic visibility a rule declares for one field:
 * - `"always"`: visible regardless of profile (e.g. fields in `basic_info` which has no
 *   profile-driven hiding today).
 * - `"active"`: visible iff the field's owning group is active for the profile (default for
 *   most fields). Group activeness is precomputed by {@link buildProfileRules}, so a rule's
 *   stored `visibility` is `"hidden"` after derivation when its group is inactive for the
 *   profile.
 * - `"hidden"`: the rule was derived for a profile in which this field is not rendered.
 *
 * Consumers should prefer reading the derived rule from `ProfileRules.fields` (where
 * inactive-group derivation is already baked in) rather than re-computing.
 */
export type FieldVisibility = "always" | "active" | "hidden";

/**
 * Required-ness tiers in the wizard rules layer.
 *
 * - `"required"` — blocks `stepNav` and `submit`; UI shows the required-field hint.
 * - `"recommended"` — **non-blocking** at every validation level (autosave / stepNav / submit);
 *   the value is **never** added to `ValidationResult.issues`. Pure UI affordance — the form
 *   renders a "recommended" badge / soft hint. Introduced in Phase P12 (promptq.md follow-up)
 *   so the Edit `tripDetailsFieldConfig.ts` `"recommended"` tier can be authored alongside
 *   the wizard rules instead of in a parallel matrix.
 * - `"optional"` — default. No UI hint, no validation enforcement.
 * - `"forbidden"` — reserved; not used by validation today (kept for future use cases like
 *   "field exists in the wire shape but the UI must not let it be set for this profile").
 */
export type FieldRequiredness = "required" | "recommended" | "optional" | "forbidden";

export type ValidationLevel = "autosave" | "stepNav" | "submit";

export type FieldRule = {
  readonly path: WizardFieldPath;
  readonly visibility: FieldVisibility;
  /**
   * Intrinsic required-ness (what the field would be if its owning step were active).
   * Effective required-ness for a profile + level + step cursor is computed by
   * {@link isFieldRequiredAtLevel}, which factors in hidden steps (replacing the legacy
   * `relaxItineraryMinDays` / `relaxLogisticsPrimary` runtime flags).
   */
  readonly required: FieldRequiredness;
  readonly belongsToStep: TourCreateWizardStepId;
  readonly belongsToGroup: FieldGroupId | "always";
};

export type StepRule = {
  readonly stepId: TourCreateWizardStepId;
  readonly visibility: "visible" | "hidden";
  readonly titleFa: string;
  /** RHF field paths validated when leaving this step (mirrors `stepTriggerFields[stepId]`). */
  readonly stepNavTriggers: readonly WizardFieldPath[];
};

export type ProfileMeta = {
  readonly profile: TourFormProfile;
  /** i18n key (no UI consumer wired yet — reserved for the future profile-info banner). */
  readonly displayKey: string;
  readonly defaultTourType?: TourType;
};

export type ProfileRules = {
  readonly profile: TourFormProfile;
  readonly meta: ProfileMeta;
  readonly steps: ReadonlyMap<TourCreateWizardStepId, StepRule>;
  readonly fields: ReadonlyMap<WizardFieldPath, FieldRule>;
};

/**
 * Aggregated view of one wizard step for a profile: rail visibility + every {@link FieldRule}
 * whose `belongsToStep` matches. Returned by {@link getStepRules}.
 */
export type StepRules = {
  readonly profile: TourFormProfile;
  readonly stepId: TourCreateWizardStepId;
  readonly step: StepRule | undefined;
  /** All field rules owned by this step, sorted by dotted path for stable iteration / tests. */
  readonly fields: readonly FieldRule[];
};

/** Convenience re-exports so consumers can import everything from `profileRules`. */
export type { FieldGroupId, TourCreateFormValues, TourCreateWizardStepId, TourFormProfile };
