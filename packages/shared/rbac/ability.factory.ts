import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";

/**
 * CASL actions used across Nest + Next. `manage` implies create, read, update, delete
 * on the subject (CASL built-in).
 */
export type WorkspaceAbilityAction = "manage" | "create" | "read" | "update" | "delete";

/**
 * Coarse subjects for workspace-scoped product areas. Instance-level rules (e.g. "own"
 * registration) can be layered later via subject objects.
 */
export type WorkspaceAbilitySubject =
  | "all"
  | "Workspace"
  | "WorkspaceOwnership"
  | "UserMembership"
  /** User-directory sensitive tabs (documents / receipts); owner & admin only via `manage all`. */
  | "UserDirectoryDocuments"
  /** Admin-only workspace notes about a member; owner & admin via `manage all`. */
  | "UserDirectoryInternalNotes"
  | "Tour"
  | "Registration"
  | "Payment"
  | "Settings"
  | "Audit"
  | "MarketingSegment";

export type AppAbility = MongoAbility<[WorkspaceAbilityAction, WorkspaceAbilitySubject]>;

/** Membership lifecycle on `user_tenants.membership_status` (uppercase in DB). */
export type UserAbilityMembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | (string & {});

export type UserAbilityContext = {
  id: string;
  role: string;
  status?: UserAbilityMembershipStatus | null;
  /** Optional marketing / CRM labels (not workspace system roles). */
  labels?: readonly string[] | null;
};

function normalizeRole(role: string | undefined | null): string {
  return (role ?? "").trim().toLowerCase();
}

function isMembershipActive(status: UserAbilityMembershipStatus | null | undefined): boolean {
  if (status === undefined || status === null || status === "") {
    return true;
  }
  return String(status).toUpperCase() === "ACTIVE";
}

function applyInactiveGate(can: AbilityBuilder<AppAbility>["can"], cannot: AbilityBuilder<AppAbility>["cannot"]): void {
  cannot("manage", "all");
  cannot("create", "Workspace");
  cannot("update", "Workspace");
  cannot("delete", "Workspace");
  can("read", "Workspace");
}

function applyMarketingLabels(can: AbilityBuilder<AppAbility>["can"], labels: readonly string[] | null | undefined): void {
  if (labels && labels.length > 0) {
    can("read", "MarketingSegment");
  }
}

function grantOwnerActive(can: AbilityBuilder<AppAbility>["can"]): void {
  can("manage", "all");
}

function grantAdminActive(can: AbilityBuilder<AppAbility>["can"], cannot: AbilityBuilder<AppAbility>["cannot"]): void {
  can("manage", "all");
  cannot("update", "WorkspaceOwnership");
}

function grantLeaderActive(can: AbilityBuilder<AppAbility>["can"], cannot: AbilityBuilder<AppAbility>["cannot"]): void {
  can("read", "Workspace");
  can("read", "UserMembership");
  can("read", "Tour");
  can("create", "Tour");
  can("update", "Tour");
  can("read", "Registration");
  can("create", "Registration");
  can("update", "Registration");
  can("read", "Payment");
  can("read", "Settings");
  can("read", "Audit");
  cannot("delete", "Workspace");
  cannot("update", "Workspace");
  cannot("update", "WorkspaceOwnership");
  cannot("manage", "Settings");
}

function grantMemberActive(can: AbilityBuilder<AppAbility>["can"], cannot: AbilityBuilder<AppAbility>["cannot"]): void {
  can("read", "Workspace");
  can("read", "Tour");
  can("create", "Registration");
  can("read", "Registration");
  can("update", "Registration");
  can("read", "Payment");
  cannot("update", "Workspace");
  cannot("update", "WorkspaceOwnership");
  cannot("manage", "UserMembership");
}

function grantViewerActive(can: AbilityBuilder<AppAbility>["can"], cannot: AbilityBuilder<AppAbility>["cannot"]): void {
  can("read", "Workspace");
  can("read", "Tour");
  can("read", "Registration");
  can("read", "UserMembership");
  can("read", "Payment");
  can("read", "Settings");
  cannot("create", "Tour");
  cannot("update", "Tour");
  cannot("delete", "Tour");
}

/**
 * Builds a CASL ability for a single workspace membership context.
 * Intended for shared use in Nest (`@casl/nestjs`) and Next (`@casl/react`).
 *
 * Non-ACTIVE memberships get a minimal read-only workspace slice; product-specific
 * invite flows can tighten further when wired to controllers.
 */
export function defineAbilityFor(userContext: UserAbilityContext): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (!isMembershipActive(userContext.status)) {
    applyInactiveGate(can, cannot);
    applyMarketingLabels(can, userContext.labels);
    return build();
  }

  applyMarketingLabels(can, userContext.labels);

  switch (normalizeRole(userContext.role)) {
    case "owner":
      grantOwnerActive(can);
      break;
    case "admin":
      grantAdminActive(can, cannot);
      break;
    case "leader":
      grantLeaderActive(can, cannot);
      break;
    case "member":
      grantMemberActive(can, cannot);
      break;
    case "viewer":
      grantViewerActive(can, cannot);
      break;
    default:
      cannot("manage", "all");
      can("read", "Workspace");
      break;
  }

  return build();
}
