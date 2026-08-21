import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveEffectiveTenantBranding,
  resolveTenantBrandingDisplayName,
  resolveWorkspacePluginIdForType,
  validateTenantTheme,
  type TenantAuthContext,
  type TenantThemeConfig,
  type TenantDefaultLocale,
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
  readonly displayNameFa: string | null;
  readonly displayNameEn: string | null;
  readonly logo: { readonly storageKey: string; readonly contentType: string | null } | null;
  readonly primaryColor: string | null;
};

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function setThemeDisplayNameField(
  raw: Record<string, unknown>,
  field: "displayName" | "displayNameFa" | "displayNameEn",
  value: string | null | undefined
): void {
  if (value === undefined) {
    return;
  }
  const trimmed = trimToNull(value);
  if (trimmed === null) {
    delete raw[field];
    return;
  }
  raw[field] = trimmed;
}

function ensureLegacyDisplayNameFallback(raw: Record<string, unknown>): void {
  const legacy = trimToNull(typeof raw.displayName === "string" ? raw.displayName : undefined);
  if (legacy !== null) {
    raw.displayName = legacy;
    return;
  }
  const localized =
    trimToNull(typeof raw.displayNameEn === "string" ? raw.displayNameEn : undefined) ??
    trimToNull(typeof raw.displayNameFa === "string" ? raw.displayNameFa : undefined);
  if (localized !== null) {
    raw.displayName = localized;
  }
}

export async function getTenantBranding(auth: TenantAuthContext): Promise<TenantBrandingResponse> {
  await assertWorkspaceBrandingModuleAccess(auth, "read");
  const theme = await readMergedTheme(auth.tenantId);
  return {
    displayName:
      theme.displayName?.trim() ??
      theme.displayNameEn?.trim() ??
      theme.displayNameFa?.trim() ??
      null,
    displayNameFa: theme.displayNameFa?.trim() ?? null,
    displayNameEn: theme.displayNameEn?.trim() ?? null,
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
  input: {
    readonly displayName?: string | null;
    readonly displayNameFa?: string | null;
    readonly displayNameEn?: string | null;
  }
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
    setThemeDisplayNameField(raw, "displayName", input.displayName);
  }
  if (input.displayNameFa !== undefined) {
    setThemeDisplayNameField(raw, "displayNameFa", input.displayNameFa);
  }
  if (input.displayNameEn !== undefined) {
    setThemeDisplayNameField(raw, "displayNameEn", input.displayNameEn);
  }
  ensureLegacyDisplayNameFallback(raw);

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

export async function resolvePublicTenantBrandingBySubdomain(
  subdomain: string,
  localeInput?: string | null
): Promise<{
  readonly displayName: string | null;
  readonly displayNameFa: string | null;
  readonly displayNameEn: string | null;
  readonly primaryColor: string | null;
  readonly logoUrl: string | null;
  readonly defaultLocale: string | null;
}> {
  const { resolveRegisteredTenantBySubdomain } = await import("./resolve-registered-tenant");
  const tenant = await resolveRegisteredTenantBySubdomain(subdomain);
  if (tenant === null) {
    throw new Error("TENANT_NOT_FOUND");
  }
  const themeJson = await resolveTenantThemeJsonById(tenant.id);
  const theme = resolveEffectiveTenantBranding(
    themeRecordFromJson(themeJson ?? tenant.theme),
    resolveDefaultTenantBranding(tenant.workspaceType)
  );
  const locale: TenantDefaultLocale =
    localeInput === "fa" || localeInput === "en"
      ? localeInput
      : theme.defaultLocale === "fa" || theme.defaultLocale === "en"
        ? theme.defaultLocale
        : "en";
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
    displayName: resolveTenantBrandingDisplayName(theme, locale, null) || null,
    displayNameFa: theme.displayNameFa?.trim() ?? null,
    displayNameEn: theme.displayNameEn?.trim() ?? null,
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
