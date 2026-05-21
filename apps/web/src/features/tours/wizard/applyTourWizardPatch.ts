import type { TourFormProfile } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";

import type { TenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { stripTenantGatedTourCreateGroups } from "@/features/tours/contracts/tenant-tour-form-contract";

import { parseTourWizardPatchPipelineStrict } from "./contract/tour-wizard-contract";
import {
  filterFormPatchByActiveGroups,
  sanitizeInactiveRootsForProfile,
} from "./fieldGroups";
import { mergeTourDraft } from "./tourCreateWizardMerge";
import type { ThemeRowForProfile, TourWizardDraftMeta } from "./tourWizardProfileResolve";

/**
 * Inputs accepted by {@link applyTourWizardPatch}. All fields except `baseValues`
 * are optional / nullable so the same pipeline can later wrap clone and draft-
 * restore call sites without forcing those callers to invent dummy values.
 */
export type ApplyTourWizardPatchInput = {
  /** Current wizard form values (e.g. `getValues()` from RHF). */
  baseValues: TourCreateFormValues;
  /** Partial wizard-shaped patch to merge onto `baseValues`. May be omitted to mean "no-op merge". */
  patch?: Partial<TourCreateFormValues>;
  /**
   * Workspace template profile (`workspace_tour_wizard_templates.base_profile`).
   * Required for all wizard patch applies — theme/tourType in the patch must not change profile.
   */
  currentProfile: TourFormProfile;
  /** Optional theme catalog (diagnostics / future use; does not affect profile resolution). */
  themeCatalog?: ThemeRowForProfile[];
  /** Optional tourType hint (diagnostics; does not affect profile resolution). */
  tourType?: string;
  /** Optional draft snapshot meta (clone/draft provenance; does not affect profile resolution). */
  snapshot?: TourWizardDraftMeta;
  /** When `form_builder` is off, strip itinerary/participation/logistics after profile sanitize. */
  tenantFormContract?: TenantTourFormContract;
};

export type ApplyTourWizardPatchResult = {
  /** Typed wizard values after merge + sanitize + {@link parseTourWizardPatchPipelineStrict}. */
  mergedValues: TourCreateFormValues;
  /**
   * Profile the wizard should be in **after** the patch is applied. When the patch
   * carries no theme/tourType change, this is the unchanged `currentProfile`. Returned
   * for diagnostics and for future clone/draft callers that want to seed `_wizardMeta`.
   */
  resolvedFormProfile: TourFormProfile;
  /** Patch after the inactive-roots filter (helpful for tests / logging; never re-merged). */
  filteredPatch: Partial<TourCreateFormValues> | undefined;
};

/**
 * Single seam for "apply a wizard-shaped patch onto current form values".
 *
 * Pipeline (in order):
 *   1. **Profile.** Always `currentProfile` from the workspace wizard template (never
 *      theme catalog or tourType).
 *   2. **Filter the patch** by dropping top-level roots owned by groups that are
 *      inactive for the **final** profile (via {@link filterFormPatchByActiveGroups}).
 *      Previously the preset-apply call site filtered against the *incoming* profile;
 *      using the final profile makes apply symmetric with the submit-time strip in
 *      `useTourWizardCreate` (whose argument is the same final profile that the
 *      Shell re-derives after `reset(...)`).
 *   3. **Merge** the filtered patch onto `baseValues` via {@link mergeTourDraft}.
 *   4. **Sanitize** the merged values against the final profile via
 *      {@link sanitizeInactiveRootsForProfile} so any ghost root resurrected by
 *      `mergeTourDraft`'s defaults / normalized day fallbacks is reset.
 *   5. **Strict schema parse** via {@link parseTourWizardPatchPipelineStrict} so the result
 *      matches the Zod wizard contract (unknown root keys rejected) without requiring submit-time
 *      completeness; {@link wizardFormToCreateTourApiPayload} still runs full submit validation.
 *
 * Observable change vs. the previous `presetDefaultsToFormPatch → filter →
 * merge → reset` sequence: when the patch flips `mainTourThemeId` / `tourType`
 * in a way that switches profiles, the filter step now uses the **new** profile.
 * Combined with the auto-save sanitize wired in `TourCreateWizard.tsx`, the new
 * behaviour merely shifts ghost-data cleanup from "next autosave tick" to "the
 * apply call itself". All other paths (general preset on general form, profile
 * that doesn't change, patch without theme/tourType inputs) are bit-for-bit
 * identical to the previous flow.
 *
 * The function is pure: it never touches RHF or localStorage. Wiring lives in
 * the call site (e.g. `TourCreationPresetBanner.applySelected`).
 */
export function applyTourWizardPatch(
  input: ApplyTourWizardPatchInput,
): ApplyTourWizardPatchResult {
  const patch = input.patch;
  const resolvedFormProfile = input.currentProfile;

  const filteredPatch = filterFormPatchByActiveGroups(resolvedFormProfile, patch);
  const merged = mergeTourDraft(input.baseValues, filteredPatch);
  let sanitized = sanitizeInactiveRootsForProfile(merged, resolvedFormProfile);
  if (input.tenantFormContract) {
    sanitized = stripTenantGatedTourCreateGroups(input.tenantFormContract, sanitized);
  }
  const mergedValues = parseTourWizardPatchPipelineStrict(resolvedFormProfile, sanitized);

  return { mergedValues, resolvedFormProfile, filteredPatch };
}
