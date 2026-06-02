import { tryParseWorkspaceRole, WorkspaceRole } from "@repo/shared";

/**
 * # Edit-side field RBAC framework
 *
 * Extracted from `tripDetailsFieldConfig.ts` in Phase P15 (promptq.md follow-up) so the
 * three concerns that used to share that file are now in separate, single-responsibility
 * modules:
 *
 * 1. **This file** — pure RBAC + visibility/required-ness types + the
 *    {@link resolveFieldAccess} resolver. No profile-axis knowledge, no field IDs,
 *    no per-matrix data. Reusable by any Edit surface that needs role-gated read/edit
 *    semantics.
 * 2. `./editCoreFieldConfig.ts` — `core.totalCapacity` / `core.capacity` matrix +
 *    leader-rank RBAC overrides. Independent of `TourFormProfile`.
 * 3. `./tripDetailsFieldConfig.ts` — the trip-details base matrix keyed by
 *    `TourFormProfile`. Still the largest of the three; physical deletion is blocked
 *    on a path-namespace rename (Edit's flat `tripDetails.*` paths vs the wizard's
 *    nested `TourCreateFormValues` paths) that is tracked as a separate future slice.
 *
 * **Public surface:** identical to what `tripDetailsFieldConfig.ts` previously exported
 * for the RBAC layer (`FieldVisibility`, `FieldRequiredness`, `UserRole`,
 * `FieldRoleConstraint`, `FieldConfigBase`, `ResolvedFieldAccess`, `resolveFieldAccess`,
 * `normalizeFieldUserRole`). `normalizeFieldUserRole` delegates to `tryParseWorkspaceRole`
 * so persisted roles (including legacy `operator` → member) stay aligned with workspace RBAC.
 */

export type FieldVisibility = "hidden" | "readonly" | "editable";
export type FieldRequiredness = "optional" | "recommended" | "required";
export type UserRole = "guest" | "member" | "leader" | "admin";

export type FieldRoleConstraint = {
  minRoleForEdit?: UserRole;
  minRoleForView?: UserRole;
};

export type FieldConfigBase = {
  visibility: FieldVisibility;
  requiredness: FieldRequiredness;
  labelOverride?: string;
  descriptionOverride?: string;
  /**
   * Minimum workspace/JWT role thresholds (rank-based). Used by core capacity fields.
   * When `allowedRoles` / `viewOnlyRoles` are set (non-empty), list-based RBAC takes
   * precedence instead.
   */
  role?: FieldRoleConstraint;
  /**
   * Explicit allow-list for edit access when `visibility === "editable"`.
   * Omit or leave empty to keep this dimension open (subject only to `role` thresholds /
   * profile visibility).
   */
  allowedRoles?: UserRole[];
  /**
   * Roles that may see the field read-only when `visibility === "editable"`.
   * Evaluated only when list-based RBAC is active (see `allowedRoles` / `viewOnlyRoles`).
   */
  viewOnlyRoles?: UserRole[];
};

export type ResolvedFieldAccess = {
  /** Effective UI mode after global visibility + RBAC. */
  accessLevel: FieldVisibility;
  /** Same as `accessLevel` (kept for callers that already use `.visibility`). */
  visibility: FieldVisibility;
  canView: boolean;
  canEdit: boolean;
  requiredness: FieldRequiredness;
};

export function normalizeFieldUserRole(rawRole: string | null | undefined): UserRole {
  const parsed = tryParseWorkspaceRole(rawRole ?? "");
  if (!parsed) return "guest";
  if (parsed === WorkspaceRole.Owner || parsed === WorkspaceRole.Admin) return "admin";
  if (parsed === WorkspaceRole.Leader) return "leader";
  if (parsed === WorkspaceRole.Member) return "member";
  if (parsed === WorkspaceRole.Viewer) return "guest";
  return "guest";
}

function roleRank(role: UserRole): number {
  if (role === "guest") return 0;
  if (role === "member") return 1;
  if (role === "leader") return 2;
  return 3;
}

function meetsMinRole(current: UserRole, min: UserRole | undefined): boolean {
  if (!min) return true;
  return roleRank(current) >= roleRank(min);
}

function hasListBasedRbac(config: FieldConfigBase | undefined): boolean {
  const a = config?.allowedRoles;
  const v = config?.viewOnlyRoles;
  return (Array.isArray(a) && a.length > 0) || (Array.isArray(v) && v.length > 0);
}

/**
 * Resolves effective field access: profile-matrix `visibility` / `requiredness` plus
 * optional RBAC.
 * - `visibility === "hidden"` → always hidden.
 * - `visibility === "readonly"` → always readonly (no role escalation to edit).
 * - `visibility === "editable"`:
 *   - If `allowedRoles` or `viewOnlyRoles` is non-empty → list-based rules: edit if role
 *     ∈ allowedRoles, else readonly if role ∈ viewOnlyRoles, else hidden.
 *   - Else if `role.minRoleForView` / `minRoleForEdit` → rank thresholds (e.g. core
 *     capacity).
 *   - Else → editable for all roles.
 */
export function resolveFieldAccess<T extends FieldConfigBase>(
  config: T | undefined,
  viewerRole: UserRole,
): ResolvedFieldAccess {
  const visibility = config?.visibility ?? "editable";
  const requiredness = config?.requiredness ?? "optional";

  if (visibility === "hidden") {
    const level = "hidden" as const;
    return { accessLevel: level, visibility: level, canView: false, canEdit: false, requiredness };
  }
  if (visibility === "readonly") {
    const level = "readonly" as const;
    return { accessLevel: level, visibility: level, canView: true, canEdit: false, requiredness };
  }

  if (hasListBasedRbac(config)) {
    const allowed = config!.allowedRoles ?? [];
    const viewOnly = config!.viewOnlyRoles ?? [];
    if (allowed.includes(viewerRole)) {
      const level = "editable" as const;
      return { accessLevel: level, visibility: level, canView: true, canEdit: true, requiredness };
    }
    if (viewOnly.includes(viewerRole)) {
      const level = "readonly" as const;
      return { accessLevel: level, visibility: level, canView: true, canEdit: false, requiredness };
    }
    const level = "hidden" as const;
    return { accessLevel: level, visibility: level, canView: false, canEdit: false, requiredness };
  }

  const canViewByRole = meetsMinRole(viewerRole, config?.role?.minRoleForView);
  const canEditByRole = meetsMinRole(viewerRole, config?.role?.minRoleForEdit);
  if (!canViewByRole) {
    const level = "hidden" as const;
    return { accessLevel: level, visibility: level, canView: false, canEdit: false, requiredness };
  }
  if (!canEditByRole) {
    const level = "readonly" as const;
    return { accessLevel: level, visibility: level, canView: true, canEdit: false, requiredness };
  }
  const level = "editable" as const;
  return { accessLevel: level, visibility: level, canView: true, canEdit: true, requiredness };
}
