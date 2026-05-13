// Edit-side trip-details + core matrix → ProfileRules overlay.
//
// Phase P6 (promptq.md): this adapter no longer projects `TourFormProfile → EventKind`.
// The base matrix in `tripDetailsFieldConfig.ts` is now keyed by `TourFormProfile`
// directly, so we ask it for the profile-base rows and then layer the wizard rules
// (`getFieldRule`) on top for any path that is registered in `BASE_FIELD_RULES`.
//
// Inventory-only paths that are not in the wizard rules (e.g. `overview.maxAltitudeMeters`,
// `participation.documentsRequired`) keep the profile-base row as-is. The shared
// `MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS` list (in `@repo/types`) is what guarantees
// that these fields are hidden for non-`mountain_outdoor` profiles, in lockstep with the
// server-side `applyMountainOverviewFieldGatesForFormProfile` (see
// `apps/api/src/modules/tours/utils/tour-type-gates.ts`).
//
// Phase P16 (promptq.md follow-up): the adapter now owns the canonical Edit→wizard
// **path-alias map** for ids whose Edit name diverges from the wizard's
// `TourCreateFormValues` shape. Pilot row: `overview.shortIntro` → `overview.shortDescription`.
// The `editTripDetailsWizardPathDivergence.spec.ts` parity spec imports this map directly
// (no duplication), and is therefore guaranteed to fail loudly if any alias target ever
// drifts out of `BASE_FIELD_RULES`.

import type { TourFormProfile } from "@repo/types";

import { getFieldRule } from "@/features/tours/wizard/profileRules/getProfileRules";
import type { WizardFieldPath } from "@/features/tours/wizard/profileRules/types";

import {
  getCoreFieldConfigForProfileBase,
  getTripDetailsFieldConfigForProfileBase,
  type TripDetailsFieldConfig,
  type TripDetailsFieldId,
} from "./tripDetailsFieldConfig";

/**
 * Canonical Edit `TripDetailsFieldId` → wizard `WizardFieldPath` alias map.
 *
 * Edit ids are not always identical to the wizard's `TourCreateFormValues` dotted paths
 * (different historical DTO shape — see `editTripDetailsWizardPathDivergence.spec.ts` for the
 * full divergence catalog). When an entry exists here, the adapter overlays the wizard rule
 * for `<wizardPath>` onto the row for `<editId>`, so the wizard's `BASE_FIELD_RULES` row is
 * the single source of truth even for the field's Edit twin.
 *
 * **Adding a new alias is a single-line edit here**; the parity spec re-validates that the
 * target path exists in `BASE_FIELD_RULES`. The long-term goal is to drain this map by
 * renaming Edit ids to match the wizard, after which `tripDetailsFieldConfig.ts` can be
 * deleted entirely (the path-namespace convergence work tracked in `promptq.md` P16+).
 */
export const EDIT_TO_WIZARD_PATH_ALIASES: Partial<Record<TripDetailsFieldId, WizardFieldPath>> = {
  // P16 pilot — string short-intro row. Same shape on both sides, no transform needed.
  "overview.shortIntro": "overview.shortDescription" as WizardFieldPath,
};

function resolveWizardPathForEditId(id: TripDetailsFieldId): WizardFieldPath | string {
  return EDIT_TO_WIZARD_PATH_ALIASES[id] ?? id;
}

export function getCoreFieldConfigForProfile(profile: TourFormProfile) {
  return getCoreFieldConfigForProfileBase(profile);
}

/**
 * Wizard `FieldRule.required` → Edit `TripDetailsFieldConfig.requiredness`. The wizard tier
 * `"recommended"` (introduced in Phase P12, see promptq.md) maps to Edit `"recommended"`,
 * keeping the Edit UI's "recommended" badge wired to the same source of truth as the wizard.
 *
 * Phase P16: when the Edit row id is listed in {@link EDIT_TO_WIZARD_PATH_ALIASES}, the
 * adapter looks up the wizard rule for the *aliased* path instead of the literal id — so
 * `BASE_FIELD_RULES.overview.shortDescription` governs the Edit row `overview.shortIntro`.
 */
export function getTripDetailsFieldConfigForProfile(profile: TourFormProfile) {
  const baseRows = getTripDetailsFieldConfigForProfileBase(profile);
  return baseRows.map((row): TripDetailsFieldConfig => {
    const wizardPath = resolveWizardPathForEditId(row.id);
    const rule = getFieldRule(profile, wizardPath);
    if (!rule) return row;
    if (rule.visibility === "hidden") {
      return { ...row, visibility: "hidden", requiredness: "optional" };
    }
    if (rule.required === "required") {
      return { ...row, visibility: "editable", requiredness: "required" };
    }
    if (rule.required === "recommended") {
      return { ...row, visibility: "editable", requiredness: "recommended" };
    }
    return { ...row, visibility: "editable", requiredness: "optional" };
  });
}
