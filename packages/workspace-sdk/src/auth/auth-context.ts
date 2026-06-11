/** Actor role within a tenant — declarative rules in ability.ts only. */
export type ActorRole = "owner" | "admin" | "member" | "viewer" | "none";

export type MembershipStatus = "ACTIVE" | "SUSPENDED";

/**
 * Pure auth context for {@link defineAbilityFor}.
 * Resolved by apps/api or apps/web — not stored in workspace-sdk.
 *
 * **Workspace binding:** `member` and `viewer` actors MUST set `workspaceId` (fail-closed otherwise).
 * `owner` / `admin` may omit `workspaceId` for tenant-wide operator scope (use sparingly).
 */
export type TenantAuthContext = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: ActorRole;
  readonly status: MembershipStatus;
  /**
   * When set, workspace-scoped subjects (`Workspace`, `WorkspaceTheme`) require this id on the
   * subject instance — blocks cross-workspace access within the same tenant.
   */
  readonly workspaceId?: string;
};
