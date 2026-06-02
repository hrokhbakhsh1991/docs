/**
 * # Edit-side core capacity field matrix
 *
 * Extracted from `tripDetailsFieldConfig.ts` in Phase P15 (promptq.md follow-up).
 *
 * Holds the two `core.*` capacity fields (`core.totalCapacity`, `core.capacity`) and
 * their leader-rank RBAC overrides. The matrix is **profile-agnostic** — capacity is a
 * tour-shape-independent concern, so the per-profile axis exists only to keep a uniform
 * shape with `tripDetailsFieldConfig.ts` (`{ profile, tripDetails[], core[] }`).
 *
 * **No `BASE_FIELD_RULES` overlap.** The wizard rules layer does not model these paths
 * (`core.*` are not in `TourCreateFormValues` — they're an Edit-side cross-cut). This
 * file is therefore unaffected by any future trip-details path-namespace convergence
 * and remains the canonical surface for capacity RBAC.
 */

import { TOUR_FORM_PROFILE_VALUES, type TourFormProfile } from "@repo/types";

import type { FieldConfigBase, FieldRoleConstraint } from "./editFieldRbac";

export type CoreFieldId = "core.totalCapacity" | "core.capacity";

export type CoreFieldConfig = FieldConfigBase & {
  id: CoreFieldId;
};

const CORE_FIELD_IDS: readonly CoreFieldId[] = ["core.totalCapacity", "core.capacity"];

const CORE_ROLE_OVERRIDES: Partial<Record<CoreFieldId, FieldRoleConstraint>> = {
  "core.totalCapacity": { minRoleForView: "leader", minRoleForEdit: "leader" },
  "core.capacity": { minRoleForView: "leader", minRoleForEdit: "leader" },
};

function buildProfileCoreConfig(): CoreFieldConfig[] {
  return CORE_FIELD_IDS.map((id) => ({
    id,
    visibility: "editable",
    requiredness: "optional",
    role: CORE_ROLE_OVERRIDES[id],
  }));
}

const PROFILE_CORE_CONFIGS: Record<TourFormProfile, CoreFieldConfig[]> = Object.fromEntries(
  TOUR_FORM_PROFILE_VALUES.map((p) => [p, buildProfileCoreConfig()] as const),
) as Record<TourFormProfile, CoreFieldConfig[]>;

/**
 * Base core (capacity) row matrix for the given profile. RBAC is profile-agnostic
 * today; the per-profile axis exists only to keep a uniform shape with trip-details.
 *
 * Phase P6: replaced the legacy `getCoreFieldConfigForKind(EventKind)`.
 * Phase P15: extracted out of `tripDetailsFieldConfig.ts`.
 */
export function getCoreFieldConfigForProfileBase(profile: TourFormProfile): CoreFieldConfig[] {
  return PROFILE_CORE_CONFIGS[profile] ?? PROFILE_CORE_CONFIGS.general;
}
