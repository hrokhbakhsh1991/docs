/**
 * PATCH field-level RBAC contract — parity with web `editCoreFieldConfig` leader gates.
 * Full capability matrix lives in `apps/api/.../tour-patch-field-policy.ts`; this file
 * holds the **rank-gate mirror** checked by `scripts/check-tour-rbac-parity.mjs`.
 * Endpoint-level roles (Owner/Admin/Leader) still apply via `RolesGuard`.
 */

export type TourPatchViewerRole = "guest" | "member" | "leader" | "admin";

/** Top-level `UpdateTourDto` keys governed by field-level PATCH policy. */
export type TourPatchDtoKey = "total_capacity";

export type TourPatchFieldRule = {
  readonly dtoKey: TourPatchDtoKey;
  readonly minRoleForEdit: TourPatchViewerRole;
};

/**
 * Mirrors `editCoreFieldConfig` (`core.totalCapacity` → `total_capacity` on the wire).
 * Extend this table when Edit gains new `minRoleForEdit` rows — not ad-hoc checks in the service.
 */
export const TOUR_PATCH_FIELD_RULES: readonly TourPatchFieldRule[] = [
  { dtoKey: "total_capacity", minRoleForEdit: "leader" },
] as const;

function roleRank(role: TourPatchViewerRole): number {
  if (role === "guest") return 0;
  if (role === "member") return 1;
  if (role === "leader") return 2;
  return 3;
}

function meetsMinRole(current: TourPatchViewerRole, min: TourPatchViewerRole): boolean {
  return roleRank(current) >= roleRank(min);
}

/**
 * Returns DTO keys present in the PATCH body that the viewer role may not edit.
 */
export function getForbiddenTourPatchDtoKeysForRole(
  viewerRole: TourPatchViewerRole,
  presentKeys: readonly string[],
): TourPatchDtoKey[] {
  const present = new Set(presentKeys);
  const forbidden: TourPatchDtoKey[] = [];

  for (const rule of TOUR_PATCH_FIELD_RULES) {
    if (!present.has(rule.dtoKey)) {
      continue;
    }
    if (!meetsMinRole(viewerRole, rule.minRoleForEdit)) {
      forbidden.push(rule.dtoKey);
    }
  }

  return forbidden.sort((a, b) => a.localeCompare(b));
}
