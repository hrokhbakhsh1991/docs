import {
  TENANT_MODULE_CAPABILITY_GRANTS,
  TENANT_MODULE_IDS,
  WORKSPACE_CAPABILITY_GRANTS,
  type SettingsCapability,
  type TenantModuleId,
  type TourCapability,
  type WorkspaceCapability,
  capabilitiesForWorkspaceRole,
} from "./capabilities";
import { parseMembershipMetadata } from "./membership-metadata";
import { tryParseWorkspaceRole, type WorkspaceRole } from "./workspace-roles";

/**
 * Product capability registry (Phase 5 — prompt.md).
 * Implementation capabilities (`tour.*`, `settings.*`) are granted to CASL today.
 * Aliases document marketing/admin ids that map to the same implementation slice.
 */
export const PRODUCT_CAPABILITY_ALIASES = {
  /** Edit trip-details matrix / form architect surface. */
  "tour.form.architect": "tour.update.tripDetails",
  /** Finance reconciliation operator read (future module gate). */
  "finance.reconciliation.review": "tour.read",
} as const satisfies Record<string, WorkspaceCapability>;

/**
 * CRM / membership labels → capability ids (Phase 8 — migrate off ad-hoc label CASL).
 * Unknown labels still fall back to legacy `applyMarketingLabels` in ability.factory.
 */
export const MARKETING_LABEL_CAPABILITY_ALIASES = {
  club_member: "marketing.segment.read",
} as const satisfies Record<string, WorkspaceCapability>;

export type ProductCapabilityAlias = keyof typeof PRODUCT_CAPABILITY_ALIASES;

export const WORKSPACE_CAPABILITY_VALUES = [
  "tour.create",
  "tour.read",
  "tour.update",
  "tour.update.core",
  "tour.update.tripDetails",
  "tour.publish",
  "tour.regional.manage",
  "settings.read",
  "settings.themes.manage",
  "settings.templates.manage",
  "module.finance",
  "module.form_builder",
  "marketing.segment.read",
] as const satisfies readonly WorkspaceCapability[];

export type RegisteredWorkspaceCapability = (typeof WORKSPACE_CAPABILITY_VALUES)[number];

export function normalizeProductCapabilityId(raw: string): WorkspaceCapability | undefined {
  const key = raw.trim();
  if (!key) {
    return undefined;
  }
  const alias = (PRODUCT_CAPABILITY_ALIASES as Record<string, WorkspaceCapability>)[key];
  if (alias) {
    return alias;
  }
  if ((WORKSPACE_CAPABILITY_VALUES as readonly string[]).includes(key)) {
    return key as WorkspaceCapability;
  }
  return undefined;
}

function uniqueCapabilities(list: readonly WorkspaceCapability[]): WorkspaceCapability[] {
  return [...new Set(list)].sort((a, b) => a.localeCompare(b));
}

export type CapabilityGrantContext = {
  role: string;
  /** Optional explicit grants from membership / session (DB hydration hook). */
  capabilities?: readonly string[] | null;
  labels?: readonly string[] | null;
  /** Parsed `tenants.enabled_modules` for the active tenant. */
  tenantModules?: readonly string[] | null;
  /** Parsed `user_tenants.membership_metadata` (capabilities slice). */
  membershipMetadata?: unknown;
};

export function capabilitiesForTenantModules(
  moduleIds: readonly string[] | null | undefined,
): WorkspaceCapability[] {
  const caps: WorkspaceCapability[] = [];
  for (const raw of moduleIds ?? []) {
    const id = raw.trim() as TenantModuleId;
    if ((TENANT_MODULE_IDS as readonly string[]).includes(id)) {
      caps.push(...TENANT_MODULE_CAPABILITY_GRANTS[id]);
    }
  }
  return caps;
}

export function allowedRegionIdsFromGrantContext(
  context: CapabilityGrantContext,
): readonly string[] {
  const meta = parseMembershipMetadata(context.membershipMetadata);
  return meta.allowedRegionIds ?? [];
}

/**
 * Regional tour list/PATCH scope applies only when `tour.regional.manage` is explicitly
 * granted on the membership row — not from static Owner/Admin/Leader role bundles.
 */
export function hasRegionalTourManageCapability(context: CapabilityGrantContext): boolean {
  if (!resolveEffectiveCapabilities(context).includes("tour.regional.manage")) {
    return false;
  }
  const meta = parseMembershipMetadata(context.membershipMetadata);
  const fromMeta = (meta.capabilities ?? []).includes("tour.regional.manage");
  const fromContext = (context.capabilities ?? []).some(
    (c) => normalizeProductCapabilityId(c) === "tour.regional.manage",
  );
  return fromMeta || fromContext;
}

/**
 * Effective capability set = role tier ∪ explicit grants ∪ label-derived grants.
 */
export function resolveEffectiveCapabilities(
  context: CapabilityGrantContext,
): readonly WorkspaceCapability[] {
  const role = tryParseWorkspaceRole(context.role);
  const fromRole = role ? [...capabilitiesForWorkspaceRole(role)] : [];

  const fromExplicit: WorkspaceCapability[] = [];
  for (const raw of context.capabilities ?? []) {
    const normalized = normalizeProductCapabilityId(raw);
    if (normalized) {
      fromExplicit.push(normalized);
    }
  }

  const fromLabels: WorkspaceCapability[] = [];
  for (const label of context.labels ?? []) {
    const marketingAlias = (MARKETING_LABEL_CAPABILITY_ALIASES as Record<string, WorkspaceCapability>)[
      label.trim()
    ];
    if (marketingAlias) {
      fromLabels.push(marketingAlias);
    }
    const normalized = normalizeProductCapabilityId(label);
    if (normalized) {
      fromLabels.push(normalized);
    }
  }

  const fromMetadata = parseMembershipMetadata(context.membershipMetadata);
  const fromMembershipMeta: WorkspaceCapability[] = [];
  for (const raw of fromMetadata.capabilities ?? []) {
    const normalized = normalizeProductCapabilityId(raw);
    if (normalized) {
      fromMembershipMeta.push(normalized);
    }
  }

  const fromTenantModules = capabilitiesForTenantModules(context.tenantModules);

  return uniqueCapabilities([
    ...fromRole,
    ...fromExplicit,
    ...fromLabels,
    ...fromMembershipMeta,
    ...fromTenantModules,
  ]);
}

export function effectiveCapabilitiesGrantTour(
  context: CapabilityGrantContext,
  capability: TourCapability,
): boolean {
  return resolveEffectiveCapabilities(context).includes(capability);
}

export function effectiveCapabilitiesGrant(
  context: CapabilityGrantContext,
  capability: WorkspaceCapability,
): boolean {
  return resolveEffectiveCapabilities(context).includes(capability);
}

export { WORKSPACE_CAPABILITY_GRANTS, capabilitiesForWorkspaceRole };
export type { WorkspaceRole, TourCapability, SettingsCapability };
