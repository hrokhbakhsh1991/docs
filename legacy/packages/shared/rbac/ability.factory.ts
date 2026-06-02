import {
  AbilityBuilder,
  createMongoAbility,
  type ForcedSubject,
  type MongoAbility
} from "@casl/ability";
import type { WorkspaceCapability } from "./capabilities";
import { resolveEffectiveCapabilities } from "./capability-registry";
import { tryParseWorkspaceRole, WorkspaceRole } from "./workspace-roles";

/**
 * CASL actions used across Nest + Next. `manage` implies create, read, update, delete
 * on the subject (CASL built-in). `publish` is used for tour lifecycle OPEN transitions.
 */
export type WorkspaceAbilityAction =
  | "manage"
  | "create"
  | "read"
  | "update"
  | "delete"
  | "publish";

/**
 * Coarse subjects for workspace-scoped product areas. Instance-level rules (e.g. "own"
 * registration) can be layered later via subject objects.
 */
/** Typed `subject("MedicalProfile", { ownerUserId })` for `ability.can` checks. */
export type MedicalProfileSubjectRef = { ownerUserId: string } & ForcedSubject<"MedicalProfile">;
/** Typed `subject("EmergencyContact", { ownerUserId })` for `ability.can` checks. */
export type EmergencyContactSubjectRef = { ownerUserId: string } & ForcedSubject<"EmergencyContact">;

export type WorkspaceAbilitySubject =
  | "all"
  | "Workspace"
  | "WorkspaceOwnership"
  | "UserMembership"
  /** User-directory sensitive tabs (documents / receipts); owner & admin only via `manage all`. */
  | "UserDirectoryDocuments"
  /** Admin-only workspace notes about a member; owner & admin via `manage all`. */
  | "UserDirectoryInternalNotes"
  /** ICE contacts for a workspace member; leader reads broadly; member limited to own rows via field rules. */
  | "EmergencyContact"
  /** Encrypted medical/sensitive payload; decrypt only in service — never log plaintext. */
  | "MedicalProfile"
  | MedicalProfileSubjectRef
  | EmergencyContactSubjectRef
  | "Tour"
  /** Core tour fields (capacity, lifecycle, cost_context) — maps to `tour.update.core`. */
  | "TourCore"
  /** `tripDetails` JSON patch surface — maps to `tour.update.tripDetails`. */
  | "TourTripDetails"
  /** Urban/cinema pricing & logistics caps inside tripDetails (Phase 8.1). */
  | "TourTripDetailsSensitive"
  | "Registration"
  | "Payment"
  | "Reconciliation"
  /** Manual debt + receipt upload (tenant `finance` module). */
  | "FinanceManualPayment"
  /** Member receipt upload for a pending manual payment. */
  | "FinanceReceipt"
  /** Owner/admin receipt review queue. */
  | "FinanceReceiptReview"
  | "Settings"
  /** Workspace tour create wizard template (fieldRulesOverlay + canonicalData). */
  | "TourWizardTemplate"
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
  /** Optional explicit capability grants (membership row / session hydration). */
  capabilities?: readonly string[] | null;
  /** Active tenant `enabled_modules` (Phase 6). */
  tenantModules?: readonly string[] | null;
  /** `user_tenants.membership_metadata` blob. */
  membershipMetadata?: unknown;
};

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

function applyMarketingCapabilityGrantsFromSet(
  can: AbilityBuilder<AppAbility>["can"],
  caps: ReadonlySet<WorkspaceCapability>,
): void {
  if (caps.has("marketing.segment.read")) {
    can("read", "MarketingSegment");
  }
}

function grantOwnerActive(can: AbilityBuilder<AppAbility>["can"]): void {
  can("manage", "all");
  can("update", "TourTripDetailsSensitive");
}

function grantAdminActive(can: AbilityBuilder<AppAbility>["can"], cannot: AbilityBuilder<AppAbility>["cannot"]): void {
  can("manage", "all");
  can("update", "TourTripDetailsSensitive");
  cannot("update", "WorkspaceOwnership");
}

function applyTourCapabilityGrantsFromSet(
  can: AbilityBuilder<AppAbility>["can"],
  caps: ReadonlySet<WorkspaceCapability>,
): void {
  if (caps.has("tour.read")) {
    can("read", "Tour");
  }
  if (caps.has("tour.create")) {
    can("create", "Tour");
  }
  if (caps.has("tour.update")) {
    can("update", "Tour");
  }
  if (caps.has("tour.publish")) {
    can("publish", "Tour");
  }
  if (caps.has("tour.update.core")) {
    can("update", "TourCore");
  }
  if (caps.has("tour.update.tripDetails")) {
    can("update", "TourTripDetails");
  }
  if (caps.has("module.form_builder")) {
    can("update", "TourTripDetailsSensitive");
  }
}

function applySettingsCapabilityGrantsFromSet(
  can: AbilityBuilder<AppAbility>["can"],
  cannot: AbilityBuilder<AppAbility>["cannot"],
  caps: ReadonlySet<WorkspaceCapability>,
): void {
  if (caps.has("settings.read")) {
    can("read", "Settings");
  }
  if (caps.has("settings.themes.manage")) {
    can("manage", "Settings");
  } else {
    cannot("manage", "Settings");
  }
  if (caps.has("settings.templates.manage")) {
    can("read", "TourWizardTemplate");
    can("update", "TourWizardTemplate");
    can("publish", "TourWizardTemplate");
  } else {
    cannot("update", "TourWizardTemplate");
    cannot("publish", "TourWizardTemplate");
  }
}

/** Tenant module capabilities merged via {@link resolveEffectiveCapabilities}. */
function applyModuleCapabilityGrantsFromSet(
  can: AbilityBuilder<AppAbility>["can"],
  caps: ReadonlySet<WorkspaceCapability>,
  workspaceRole: WorkspaceRole | null,
): void {
  if (caps.has("module.finance")) {
    can("read", "Reconciliation");
    can("read", "FinanceManualPayment");
    can("create", "FinanceReceipt");
    if (
      workspaceRole === WorkspaceRole.Owner ||
      workspaceRole === WorkspaceRole.Admin
    ) {
      can("create", "FinanceManualPayment");
      can("read", "FinanceReceiptReview");
      can("update", "FinanceReceiptReview");
    }
  }
  if (caps.has("module.form_builder")) {
    can("update", "TourTripDetails");
  }
}

function grantLeaderActive(
  can: AbilityBuilder<AppAbility>["can"],
  cannot: AbilityBuilder<AppAbility>["cannot"],
  caps: ReadonlySet<WorkspaceCapability>,
): void {
  can("read", "Workspace");
  can("read", "UserMembership");
  applyTourCapabilityGrantsFromSet(can, caps);
  applySettingsCapabilityGrantsFromSet(can, cannot, caps);
  applyModuleCapabilityGrantsFromSet(can, caps, WorkspaceRole.Leader);
  can("read", "Registration");
  can("create", "Registration");
  can("update", "Registration");
  can("read", "Payment");
  /** Payment intents for participant/leader flows (server still scopes rows). */
  can("create", "Payment");
  can("read", "Audit");
  can("read", "Reconciliation");
  can("read", "MedicalProfile");
  can("read", "EmergencyContact");
  can("update", "EmergencyContact");
  can("update", "TourTripDetailsSensitive");
  cannot("delete", "Workspace");
  cannot("update", "Workspace");
  cannot("update", "WorkspaceOwnership");
}

function grantMemberActive(
  can: AbilityBuilder<AppAbility>["can"],
  cannot: AbilityBuilder<AppAbility>["cannot"],
  userContext: UserAbilityContext,
  caps: ReadonlySet<WorkspaceCapability>,
): void {
  can("read", "Workspace");
  applyTourCapabilityGrantsFromSet(can, caps);
  applySettingsCapabilityGrantsFromSet(can, cannot, caps);
  applyModuleCapabilityGrantsFromSet(can, caps, WorkspaceRole.Member);
  can("create", "Registration");
  can("read", "Registration");
  can("update", "Registration");
  can("read", "Payment");
  can("create", "Payment");
  can("read", "MedicalProfile", { ownerUserId: userContext.id });
  can("update", "MedicalProfile", { ownerUserId: userContext.id });
  can("read", "EmergencyContact", { ownerUserId: userContext.id });
  can("update", "EmergencyContact", { ownerUserId: userContext.id });
  cannot("update", "Workspace");
  cannot("update", "WorkspaceOwnership");
  cannot("manage", "UserMembership");
}

function grantViewerActive(
  can: AbilityBuilder<AppAbility>["can"],
  cannot: AbilityBuilder<AppAbility>["cannot"],
  caps: ReadonlySet<WorkspaceCapability>,
): void {
  can("read", "Workspace");
  applyTourCapabilityGrantsFromSet(can, caps);
  applySettingsCapabilityGrantsFromSet(can, cannot, caps);
  applyModuleCapabilityGrantsFromSet(can, caps, WorkspaceRole.Viewer);
  can("read", "Registration");
  can("read", "UserMembership");
  can("read", "Payment");
  can("read", "Settings");
  cannot("create", "Tour");
  cannot("update", "Tour");
  cannot("update", "TourCore");
  cannot("update", "TourTripDetails");
  cannot("publish", "Tour");
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

  const effectiveCaps = new Set(
    resolveEffectiveCapabilities({
      role: userContext.role,
      labels: userContext.labels,
      capabilities: userContext.capabilities,
      tenantModules: userContext.tenantModules,
      membershipMetadata: userContext.membershipMetadata,
    }),
  );
  applyMarketingLabels(can, userContext.labels);
  applyMarketingCapabilityGrantsFromSet(can, effectiveCaps);

  const workspaceRole = tryParseWorkspaceRole(userContext.role);
  if (workspaceRole === WorkspaceRole.Owner || workspaceRole === WorkspaceRole.Admin) {
    applyModuleCapabilityGrantsFromSet(can, effectiveCaps, workspaceRole);
  }
  switch (workspaceRole) {
    case WorkspaceRole.Owner:
      grantOwnerActive(can);
      break;
    case WorkspaceRole.Admin:
      grantAdminActive(can, cannot);
      break;
    case WorkspaceRole.Leader:
      grantLeaderActive(can, cannot, effectiveCaps);
      break;
    case WorkspaceRole.Member:
      grantMemberActive(can, cannot, userContext, effectiveCaps);
      break;
    case WorkspaceRole.Viewer:
      grantViewerActive(can, cannot, effectiveCaps);
      break;
    default:
      cannot("manage", "all");
      can("read", "Workspace");
      break;
  }

  return build();
}
