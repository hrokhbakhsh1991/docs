import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { requireActiveTraceId } from "../observability/trace-request-context";
import { resolveTenantThemeJsonById } from "../tenant/resolve-registered-tenant";
import { isStaticTenantRegistryAllowed } from "../tenant/tenant-registry";
import { isPersistedTenantUuid } from "../tenant/tenant-id-format";
import { setCachedTenantThemeById } from "../tenant/tenant-registry-cache";
import { updateTenantRegistryRow } from "../tenant/update-tenant-registry-row";
import type { UrbanSettingsPatchBody } from "./schemas/urban-settings-patch.schema";

const DEFAULT_URBAN_CATALOG = { publicEnabled: true, slug: "catalog" } as const;
const DEFAULT_URBAN_REGISTRATION = { policy: "open" as const, requirePhone: false };
const DEFAULT_URBAN = {
  catalog: DEFAULT_URBAN_CATALOG,
  registration: DEFAULT_URBAN_REGISTRATION,
} as const;

export type UrbanSettingsUrban = {
  readonly catalog: {
    readonly publicEnabled: boolean;
    readonly slug: string;
  };
  readonly registration: {
    readonly policy: "open" | "waitlist" | "closed";
    readonly requirePhone?: boolean;
    readonly confirmationMessage?: string;
  };
};

export type UrbanSettingsGetEnvelope = {
  readonly success: true;
  readonly data: { readonly urban: UrbanSettingsUrban };
  readonly metadata: {
    readonly tenantId: string;
    readonly workspaceId: string | undefined;
    readonly workspaceType: string;
    readonly correlationId: string;
    readonly primaryColor: string | null;
    readonly featureFlags: Record<string, unknown> | null;
    readonly rateLimitRps: number | null;
  };
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeUrbanSubtree(
  existingUrban: unknown,
  patchUrban: UrbanSettingsPatchBody["urban"]
): UrbanSettingsUrban {
  const base: Record<string, unknown> = isPlainObject(existingUrban)
    ? cloneJson(existingUrban)
    : cloneJson(DEFAULT_URBAN);

  const catalogBase: Record<string, unknown> = isPlainObject(base.catalog)
    ? { ...base.catalog }
    : cloneJson(DEFAULT_URBAN_CATALOG);
  catalogBase.publicEnabled = patchUrban.catalog.publicEnabled;
  catalogBase.slug = patchUrban.catalog.slug;
  base.catalog = catalogBase;

  const regBase: Record<string, unknown> = isPlainObject(base.registration)
    ? { ...base.registration }
    : cloneJson(DEFAULT_URBAN_REGISTRATION);
  regBase.policy = patchUrban.registration.policy;
  if ("requirePhone" in patchUrban.registration) {
    regBase.requirePhone = patchUrban.registration.requirePhone;
  } else if (!("requirePhone" in regBase)) {
    regBase.requirePhone = DEFAULT_URBAN_REGISTRATION.requirePhone;
  }
  if ("confirmationMessage" in patchUrban.registration) {
    regBase.confirmationMessage = patchUrban.registration.confirmationMessage;
  } else {
    delete regBase.confirmationMessage;
  }
  base.registration = regBase;

  return base as UrbanSettingsUrban;
}

export function patchThemeUrban(
  existingTheme: unknown,
  patchBody: UrbanSettingsPatchBody
): Record<string, unknown> {
  const mergedTheme: Record<string, unknown> = isPlainObject(existingTheme)
    ? cloneJson(existingTheme)
    : {};
  mergedTheme.urban = mergeUrbanSubtree(
    isPlainObject(existingTheme) ? existingTheme.urban : null,
    patchBody.urban
  );
  return mergedTheme;
}

function normalizeUrbanSubtree(existingUrban: unknown): UrbanSettingsUrban {
  const base = isPlainObject(existingUrban) ? cloneJson(existingUrban) : cloneJson(DEFAULT_URBAN);
  const catalogRaw = isPlainObject(base.catalog) ? base.catalog : cloneJson(DEFAULT_URBAN_CATALOG);
  const catalog = {
    publicEnabled:
      typeof catalogRaw.publicEnabled === "boolean"
        ? catalogRaw.publicEnabled
        : DEFAULT_URBAN_CATALOG.publicEnabled,
    slug: typeof catalogRaw.slug === "string" ? catalogRaw.slug : DEFAULT_URBAN_CATALOG.slug,
  };
  const registrationRaw: Record<string, unknown> = isPlainObject(base.registration)
    ? base.registration
    : cloneJson(DEFAULT_URBAN_REGISTRATION);
  const policy =
    registrationRaw.policy === "open" ||
    registrationRaw.policy === "waitlist" ||
    registrationRaw.policy === "closed"
      ? registrationRaw.policy
      : DEFAULT_URBAN_REGISTRATION.policy;
  const registration: UrbanSettingsUrban["registration"] = {
    policy,
    requirePhone:
      typeof registrationRaw.requirePhone === "boolean"
        ? registrationRaw.requirePhone
        : DEFAULT_URBAN_REGISTRATION.requirePhone,
    ...(typeof registrationRaw.confirmationMessage === "string"
      ? { confirmationMessage: registrationRaw.confirmationMessage }
      : {}),
  };
  return { catalog, registration };
}

function readUrbanFromTheme(theme: unknown): UrbanSettingsUrban {
  if (isPlainObject(theme) && isPlainObject(theme.urban)) {
    return normalizeUrbanSubtree(theme.urban);
  }
  return cloneJson(DEFAULT_URBAN);
}

function readThemeMetadata(
  theme: unknown,
  auth: TenantAuthContext,
  workspaceType: string
): UrbanSettingsGetEnvelope["metadata"] {
  const record = isPlainObject(theme) ? theme : {};
  return {
    tenantId: auth.tenantId,
    workspaceId: auth.workspaceId,
    workspaceType,
    correlationId: requireActiveTraceId(),
    primaryColor: typeof record.primaryColor === "string" ? record.primaryColor : null,
    featureFlags: isPlainObject(record.featureFlags)
      ? (record.featureFlags as Record<string, unknown>)
      : null,
    rateLimitRps: typeof record.rateLimitRps === "number" ? record.rateLimitRps : null,
  };
}

async function persistMergedTheme(
  tenantId: string,
  mergedTheme: Record<string, unknown>
): Promise<void> {
  const normalized = tenantId.trim().toLowerCase();
  setCachedTenantThemeById(normalized, mergedTheme);
  if (
    process.env.DATABASE_URL?.trim() &&
    isPersistedTenantUuid(normalized) &&
    !isStaticTenantRegistryAllowed()
  ) {
    await updateTenantRegistryRow(normalized, {
      theme: JSON.parse(JSON.stringify(mergedTheme)) as Parameters<
        typeof updateTenantRegistryRow
      >[1]["theme"],
    });
  }
}

export async function readUrbanRegistrationPolicyForTenant(
  tenantId: string
): Promise<"open" | "waitlist" | "closed"> {
  const theme = await resolveTenantThemeJsonById(tenantId);
  return readUrbanFromTheme(theme).registration.policy;
}

export async function getUrbanSettings(
  auth: TenantAuthContext,
  workspaceType: string
): Promise<UrbanSettingsGetEnvelope> {
  const theme = await resolveTenantThemeJsonById(auth.tenantId);
  return {
    success: true,
    data: { urban: readUrbanFromTheme(theme) },
    metadata: readThemeMetadata(theme, auth, workspaceType),
  };
}

export async function patchUrbanSettings(
  auth: TenantAuthContext,
  patchBody: UrbanSettingsPatchBody
): Promise<{ readonly urban: UrbanSettingsUrban }> {
  const existingTheme = await resolveTenantThemeJsonById(auth.tenantId);
  const mergedTheme = patchThemeUrban(existingTheme, patchBody);
  await persistMergedTheme(auth.tenantId, mergedTheme);
  return { urban: readUrbanFromTheme(mergedTheme) };
}
