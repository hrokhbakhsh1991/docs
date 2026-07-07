import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getUrbanHttpHost } from "./host-runtime";
import type { UrbanSettingsPatchBody } from "./schemas/urban-settings-patch.schema";
import {
  patchThemeUrban,
  readUrbanFromTheme,
  type UrbanSettingsUrban,
} from "./theme-merge";

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

function readThemeMetadata(
  theme: unknown,
  auth: TenantAuthContext,
  workspaceType: string
): UrbanSettingsGetEnvelope["metadata"] {
  const host = getUrbanHttpHost();
  const record = isPlainObject(theme) ? theme : {};
  return {
    tenantId: auth.tenantId,
    workspaceId: auth.workspaceId,
    workspaceType,
    correlationId: host.settings.requireActiveTraceId(),
    primaryColor: typeof record.primaryColor === "string" ? record.primaryColor : null,
    featureFlags: isPlainObject(record.featureFlags)
      ? (record.featureFlags as Record<string, unknown>)
      : null,
    rateLimitRps: typeof record.rateLimitRps === "number" ? record.rateLimitRps : null,
  };
}

export async function getUrbanSettings(
  auth: TenantAuthContext,
  workspaceType: string
): Promise<UrbanSettingsGetEnvelope> {
  const host = getUrbanHttpHost();
  const theme = await host.settings.resolveTenantThemeJsonById(auth.tenantId);
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
  const host = getUrbanHttpHost();
  const existingTheme = await host.settings.resolveTenantThemeJsonById(auth.tenantId);
  const mergedTheme = patchThemeUrban(existingTheme, patchBody);
  await host.settings.persistTenantTheme(auth.tenantId, mergedTheme);
  return { urban: readUrbanFromTheme(mergedTheme) };
}

export async function readUrbanRegistrationPolicyForTenant(
  tenantId: string
): Promise<"open" | "waitlist" | "closed"> {
  const host = getUrbanHttpHost();
  const theme = await host.settings.resolveTenantThemeJsonById(tenantId);
  return readUrbanFromTheme(theme).registration.policy;
}

export { patchThemeUrban } from "./theme-merge";
