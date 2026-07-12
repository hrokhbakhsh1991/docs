import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveEffectiveTenantBranding,
  resolveWorkspacePluginIdForType,
  validateTenantTheme,
  type TenantAuthContext,
  type TenantThemeConfig,
  type WorkspaceTypeId,
} from "@app-tour/workspace-sdk";

import { resolveDefaultTenantBranding } from "./workspace-default-tenant-branding";

import { assertWorkspaceBrandingModuleAccess } from "../settings/settings-branding-module-access";
import type { TenantSiteSurfaces } from "../platform/read-tenant-site-surfaces.ts";
import { readTenantSiteSurfacesByTenantId } from "../platform/read-tenant-site-surfaces.ts";

import {
  resolveRegisteredTenantById,
  resolveTenantThemeJsonById,
} from "./resolve-registered-tenant";
import { updateTenantRegistryRow } from "./update-tenant-registry-row";
import {
  assertTenantBrandLogoUploadContentType,
  deleteTenantBrandLogoObject,
  getTenantBrandLogoSignedReadUrl,
  putTenantBrandLogo,
} from "./tenant-branding-storage";

/** Public marketing/portal shell — align with catalog cover presign (public-catalog.md M14.1). */
export const PUBLIC_TENANT_BRAND_LOGO_SIGNED_URL_TTL_SECONDS = 3600;

function themeRecordFromJson(theme: unknown): Record<string, unknown> {
  if (theme === null || typeof theme !== "object" || Array.isArray(theme)) {
    return {};
  }
  return { ...(theme as Record<string, unknown>) };
}

async function readMergedTheme(tenantId: string): Promise<TenantThemeConfig> {
  const tenant = await resolveRegisteredTenantById(tenantId);
  if (tenant === null) {
    throw new Error("TENANT_NOT_FOUND");
  }
  const themeJson = await resolveTenantThemeJsonById(tenantId);
  const raw = themeRecordFromJson(themeJson ?? tenant.theme);
  validateTenantTheme(raw);
  return resolveEffectiveTenantBranding(raw, resolveDefaultTenantBranding(tenant.workspaceType));
}

export type TenantBrandingResponse = {
  readonly displayName: string | null;
  readonly logo: { readonly storageKey: string; readonly contentType: string | null } | null;
  readonly primaryColor: string | null;
};

export async function getTenantBranding(auth: TenantAuthContext): Promise<TenantBrandingResponse> {
  await assertWorkspaceBrandingModuleAccess(auth, "read");
  const theme = await readMergedTheme(auth.tenantId);
  return {
    displayName: theme.displayName?.trim() ?? null,
    logo: theme.logo?.storageKey
      ? {
          storageKey: theme.logo.storageKey,
          contentType: theme.logo.contentType ?? null,
        }
      : null,
    primaryColor: theme.primaryColor ?? null,
  };
}

export async function patchTenantBranding(
  auth: TenantAuthContext,
  input: { readonly displayName?: string | null }
): Promise<TenantBrandingResponse> {
  await assertWorkspaceBrandingModuleAccess(auth, "mutate");
  const tenant = await resolveRegisteredTenantById(auth.tenantId);
  if (tenant === null) {
    throw new Error("TENANT_NOT_FOUND");
  }

  const themeJson = await resolveTenantThemeJsonById(auth.tenantId);
  const raw = themeRecordFromJson(themeJson ?? tenant.theme);
  if (input.displayName === null) {
    delete raw.displayName;
  } else if (input.displayName !== undefined) {
    const trimmed = input.displayName.trim();
    if (trimmed.length === 0) {
      delete raw.displayName;
    } else {
      raw.displayName = trimmed;
    }
  }

  validateTenantTheme(raw);
  await updateTenantRegistryRow(auth.tenantId, {
    theme: JSON.parse(JSON.stringify(raw)),
  });
  return getTenantBranding(auth);
}

export async function uploadTenantBrandLogo(
  auth: TenantAuthContext,
  body: Buffer,
  contentType: string
): Promise<TenantBrandingResponse> {
  await assertWorkspaceBrandingModuleAccess(auth, "mutate");
  assertTenantBrandLogoUploadContentType(contentType);
  const tenant = await resolveRegisteredTenantById(auth.tenantId);
  if (tenant === null) {
    throw new Error("TENANT_NOT_FOUND");
  }

  const { storageKey } = await putTenantBrandLogo({
    tenantId: auth.tenantId,
    body,
    contentType,
  });

  const themeJson = await resolveTenantThemeJsonById(auth.tenantId);
  const raw = themeRecordFromJson(themeJson ?? tenant.theme);
  raw.logo = {
    storageKey,
    contentType: contentType.trim().toLowerCase(),
  };

  validateTenantTheme(raw);
  await updateTenantRegistryRow(auth.tenantId, {
    theme: JSON.parse(JSON.stringify(raw)),
  });
  return getTenantBranding(auth);
}

export async function removeTenantBrandLogo(
  auth: TenantAuthContext
): Promise<TenantBrandingResponse> {
  await assertWorkspaceBrandingModuleAccess(auth, "mutate");
  const tenant = await resolveRegisteredTenantById(auth.tenantId);
  if (tenant === null) {
    throw new Error("TENANT_NOT_FOUND");
  }

  const themeJson = await resolveTenantThemeJsonById(auth.tenantId);
  const raw = themeRecordFromJson(themeJson ?? tenant.theme);
  const existingKey =
    raw.logo !== null &&
    typeof raw.logo === "object" &&
    typeof (raw.logo as Record<string, unknown>).storageKey === "string"
      ? String((raw.logo as Record<string, unknown>).storageKey)
      : null;

  if (existingKey !== null) {
    try {
      await deleteTenantBrandLogoObject({
        tenantId: auth.tenantId,
        storageKey: existingKey,
      });
    } catch {
      // Best-effort — theme row is SoT; orphan object is acceptable in dev.
    }
    delete raw.logo;
  }

  validateTenantTheme(raw);
  await updateTenantRegistryRow(auth.tenantId, {
    theme: JSON.parse(JSON.stringify(raw)),
  });
  return getTenantBranding(auth);
}

export async function resolveTenantBrandLogoUrl(
  auth: TenantAuthContext
): Promise<{ readonly url: string; readonly storageKey: string }> {
  await assertWorkspaceBrandingModuleAccess(auth, "read");
  const theme = await readMergedTheme(auth.tenantId);
  const storageKey = theme.logo?.storageKey?.trim() ?? "";
  if (storageKey.length === 0) {
    throw new Error("TENANT_BRAND_LOGO_NOT_SET");
  }
  const url = await getTenantBrandLogoSignedReadUrl({
    tenantId: auth.tenantId,
    storageKey,
  });
  return { url, storageKey };
}

export async function resolvePublicTenantBrandingBySubdomain(subdomain: string): Promise<{
  readonly displayName: string | null;
  readonly primaryColor: string | null;
  readonly logoUrl: string | null;
  readonly defaultLocale: string | null;
}> {
  const { resolveRegisteredTenantBySubdomain } = await import("./resolve-registered-tenant");
  const tenant = await resolveRegisteredTenantBySubdomain(subdomain);
  if (tenant === null) {
    throw new Error("TENANT_NOT_FOUND");
  }
  const theme = tenant.theme;
  let logoUrl: string | null = null;
  const storageKey = theme.logo?.storageKey?.trim() ?? "";
  if (storageKey.length > 0) {
    try {
      logoUrl = await getTenantBrandLogoSignedReadUrl({
        tenantId: tenant.id,
        storageKey,
        expiresInSeconds: PUBLIC_TENANT_BRAND_LOGO_SIGNED_URL_TTL_SECONDS,
      });
    } catch {
      logoUrl = null;
    }
  }
  return {
    displayName: theme.displayName?.trim() ?? null,
    primaryColor: theme.primaryColor ?? null,
    logoUrl,
    defaultLocale: theme.defaultLocale ?? null,
  };
}

export async function resolvePublicTenantContextBySubdomain(subdomain: string): Promise<{
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly pluginId: string;
  readonly siteSurfaces: TenantSiteSurfaces;
}> {
  const { resolveRegisteredTenantBySubdomain } = await import("./resolve-registered-tenant");
  const tenant = await resolveRegisteredTenantBySubdomain(subdomain);
  if (tenant === null) {
    throw new Error("TENANT_NOT_FOUND");
  }
  const pluginId = resolveWorkspacePluginIdForType(
    tenant.workspaceType as WorkspaceTypeId,
    DEFAULT_WORKSPACE_TYPE_BINDINGS
  );
  if (pluginId === null) {
    throw new Error("WORKSPACE_PLUGIN_UNBOUND");
  }
  const siteSurfaces = await readTenantSiteSurfacesByTenantId(tenant.id);
  return {
    tenantId: tenant.id,
    workspaceType: tenant.workspaceType,
    pluginId,
    siteSurfaces,
  };
}
