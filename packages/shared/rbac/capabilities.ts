import { WorkspaceRole } from "./workspace-roles";

/**
 * Fine-grained workspace capabilities (Phase 3 — prompt.md extensibility).
 * New product behavior should gate on capabilities, not new {@link WorkspaceRole} literals.
 */

export const TOUR_CAPABILITIES = [
  "tour.create",
  "tour.read",
  "tour.update",
  "tour.update.core",
  "tour.update.tripDetails",
  "tour.publish",
  "tour.regional.manage",
] as const;

export type TourCapability = (typeof TOUR_CAPABILITIES)[number];

export const SETTINGS_CAPABILITIES = ["settings.read", "settings.themes.manage"] as const;

export type SettingsCapability = (typeof SETTINGS_CAPABILITIES)[number];

/** Tenant product modules (`tenants.enabled_modules`). */
export const TENANT_MODULE_IDS = ["finance", "form_builder"] as const;

export type TenantModuleId = (typeof TENANT_MODULE_IDS)[number];

export const MODULE_CAPABILITIES = ["module.finance", "module.form_builder"] as const;

export const MARKETING_CAPABILITIES = ["marketing.segment.read"] as const;

export type MarketingCapability = (typeof MARKETING_CAPABILITIES)[number];

export type ModuleCapability = (typeof MODULE_CAPABILITIES)[number];

export type WorkspaceCapability =
  | TourCapability
  | SettingsCapability
  | ModuleCapability
  | MarketingCapability;

/** Capabilities granted when a tenant module is enabled (merged in {@link resolveEffectiveCapabilities}). */
export const TENANT_MODULE_CAPABILITY_GRANTS: Readonly<
  Record<TenantModuleId, readonly WorkspaceCapability[]>
> = {
  finance: ["module.finance"],
  form_builder: ["module.form_builder"],
};

const ALL_TOUR_CAPABILITIES: readonly TourCapability[] = [...TOUR_CAPABILITIES];

/**
 * Static capability grants per workspace role (tier-based membership unchanged).
 * Owner/Admin still receive `manage all` in CASL; this table is the explicit contract
 * for tour/settings slices and parity tests.
 */
export const WORKSPACE_CAPABILITY_GRANTS: Readonly<
  Record<WorkspaceRole, readonly WorkspaceCapability[]>
> = {
  [WorkspaceRole.Owner]: [...ALL_TOUR_CAPABILITIES, "settings.read", "settings.themes.manage"],
  [WorkspaceRole.Admin]: [...ALL_TOUR_CAPABILITIES, "settings.read", "settings.themes.manage"],
  [WorkspaceRole.Leader]: [...ALL_TOUR_CAPABILITIES, "settings.read"],
  [WorkspaceRole.Member]: ["tour.read", "settings.read"],
  [WorkspaceRole.Viewer]: ["tour.read", "settings.read"],
};

export function capabilitiesForWorkspaceRole(
  role: WorkspaceRole,
): readonly WorkspaceCapability[] {
  return WORKSPACE_CAPABILITY_GRANTS[role] ?? [];
}

export function roleGrantsCapability(
  role: WorkspaceRole,
  capability: WorkspaceCapability,
): boolean {
  return capabilitiesForWorkspaceRole(role).includes(capability);
}

export function roleGrantsTourCapability(
  role: WorkspaceRole,
  capability: TourCapability,
): boolean {
  return roleGrantsCapability(role, capability);
}
