/**
 * Phase 8.1 contract — canonical source for apps/web/src/urban/urban-settings-access.ts
 * Authority: docs/phase-8/appendices/CASL-URBAN-OWNER-SPEC.md § Web layer · DEC-P8-004
 *
 * Implementation law: apps/web/src/urban/urban-settings-access.ts MUST re-export this module
 * (or identical signatures) — do not duplicate canLoadUrbanSettings logic in web.
 */
/** Structural slice of `TenantAuthz` — no workspace-sdk import (web tsc compiles this file via re-export). */
export type UrbanOwnerAuthz = {
  canPerformWorkspaceOwnerMutation(
    tenantId: string,
    surface: string,
    workspaceType: string,
    policy: {
      readonly requiredWorkspaceType: string;
      readonly allowedSurfaces: ReadonlySet<string>;
    }
  ): boolean;
};

const URBAN_SETTINGS_READ_POLICY = {
  requiredWorkspaceType: "urban",
  allowedSurfaces: new Set<string>(["urban.settings.read"]),
} as const;

export const CANLOAD_URBAN_SETTINGS_PLUGIN_ID = "urban" as const;

export const CANLOAD_URBAN_SETTINGS_SURFACE = "urban.settings.read" as const;

export type CanLoadUrbanSettingsParams = {
  readonly authz: UrbanOwnerAuthz;
  readonly tenantId: string;
  readonly workspaceId: string | undefined;
  readonly workspaceType: string;
  readonly pluginId: typeof CANLOAD_URBAN_SETTINGS_PLUGIN_ID;
};

export type CanLoadUrbanSettingsResult = boolean;

export function canLoadUrbanSettings(
  params: CanLoadUrbanSettingsParams
): CanLoadUrbanSettingsResult {
  if (params.pluginId !== CANLOAD_URBAN_SETTINGS_PLUGIN_ID) {
    return false;
  }
  if (params.workspaceType !== "urban") {
    return false;
  }
  if (params.tenantId.trim().length === 0) {
    return false;
  }
  return params.authz.canPerformWorkspaceOwnerMutation(
    params.tenantId,
    CANLOAD_URBAN_SETTINGS_SURFACE,
    params.workspaceType,
    URBAN_SETTINGS_READ_POLICY
  );
}

export const URBAN_SETTINGS_PAGE_PATH = "/settings/urban" as const;

export const URBAN_SETTINGS_PAGE_MODULE = "apps/web/app/(app)/settings/urban/page.tsx" as const;

export const URBAN_SETTINGS_ACCESS_MODULE = "apps/web/src/urban/urban-settings-access.ts" as const;

export const WIZARD_ACCESS_DENIED_MODULE = "apps/web/src/wizard/wizard-access-denied.tsx" as const;

export type UrbanSettingsForbiddenDomContract = {
  readonly role: "alert";
  readonly "data-workspace-wizard-forbidden": true;
  readonly "data-status-code": "403";
  readonly "aria-live": "assertive";
};

export const URBAN_SETTINGS_FORBIDDEN_DOM: UrbanSettingsForbiddenDomContract = {
  role: "alert",
  "data-workspace-wizard-forbidden": true,
  "data-status-code": "403",
  "aria-live": "assertive",
};

export type UrbanSettingsPageRenderBranch =
  | { readonly kind: "allowed"; readonly render: "UrbanOwnerSettingsPanel" }
  | { readonly kind: "forbidden"; readonly render: "WizardAccessDenied" };

export function resolveUrbanSettingsPageBranch(
  params: CanLoadUrbanSettingsParams
): UrbanSettingsPageRenderBranch {
  if (canLoadUrbanSettings(params)) {
    return { kind: "allowed", render: "UrbanOwnerSettingsPanel" };
  }
  return { kind: "forbidden", render: "WizardAccessDenied" };
}

/**
 * apps/web/app/(app)/settings/urban/page.tsx — frozen render contract
 *
 * export default async function UrbanSettingsPage() {
 *   const session = await resolveWebTenantSession();
 *   const authz = buildTenantAuthz(session.auth);
 *   const workspaceType = await resolveWorkspaceTypeForTenant(session.auth.tenantId);
 *   const branch = resolveUrbanSettingsPageBranch({
 *     authz,
 *     tenantId: session.auth.tenantId,
 *     workspaceId: session.auth.workspaceId,
 *     workspaceType,
 *     pluginId: CANLOAD_URBAN_SETTINGS_PLUGIN_ID,
 *   });
 *   if (branch.kind === "forbidden") {
 *     return <WizardAccessDenied />;
 *   }
 *   return <UrbanOwnerSettingsPanel />;
 * }
 */

export const URBAN_SETTINGS_FORBIDDEN_RULES = {
  mustRenderWizardAccessDenied: true,
  mustNotThrowOnForbidden: true,
  mustNotRenderSettingsFormFields: true,
  mustNotIssuePatchUrbanSettings: true,
  forbiddenDomSelector: "[data-workspace-wizard-forbidden]",
  forbiddenStatusAttribute: "[data-status-code='403']",
} as const;
