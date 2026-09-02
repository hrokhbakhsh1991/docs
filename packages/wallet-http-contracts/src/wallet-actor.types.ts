/**
 * Framework-neutral wallet HTTP actor/context types (Phase 2D).
 */

export type WalletHttpActorRole = "operator" | "member" | "system";

export type WalletHttpActorContext = {
  readonly actorUserId: string;
  readonly actorRole: WalletHttpActorRole;
};

export type WalletHttpTenantContext = {
  readonly tenantId: string;
  readonly workspaceId?: string;
  readonly userId: string;
  readonly role: "admin" | "owner" | "member" | "none";
  readonly status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
};
