import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getSettingsConfigRepository } from "./create-settings-config-repository";
import { emitSettingsConfigAudit } from "./settings-audit-emitter";
import { assertWizardTemplateFieldsKnown, SettingsWizardUnknownFieldError } from "./wizard-template-catalog";
import {
  resolveSettingsModuleByConfigKeyForTenant,
  SettingsConfigUnknownError,
} from "./settings-registry";
import type {
  PresetsAdvancedMatchRule,
  PresetsAdvancedPayloadV1,
  PutSettingsConfigRequest,
  SettingsConfigResponse,
  WizardTemplatePayloadV1,
} from "./settings.types";
import { SettingsMutationForbiddenError } from "./settings.service";
import { assertSettingsConfigWorkspaceAllowed } from "./settings-workspace-guard";

export { SettingsWizardUnknownFieldError } from "./wizard-template-catalog";
export class SettingsConfigVersionUnsupportedError extends Error {
  readonly code = "SETTINGS_CONFIG_VERSION_UNSUPPORTED" as const;

  constructor(readonly configVersion: number) {
    super(`SETTINGS_CONFIG_VERSION_UNSUPPORTED:${configVersion}`);
    this.name = "SettingsConfigVersionUnsupportedError";
  }
}

const WIZARD_TEMPLATE_CURRENT_VERSION = 1;
const PRESETS_ADVANCED_CURRENT_VERSION = 1;

const WIZARD_TEMPLATE_WORKSPACE_DEFAULT: WizardTemplatePayloadV1 = {
  seedLabel: "",
  sections: [
    { id: "basics", label: "Basics", enabled: true },
    { id: "itinerary", label: "Itinerary", enabled: true },
  ],
};

const PRESETS_ADVANCED_WORKSPACE_DEFAULT: PresetsAdvancedPayloadV1 = {
  autoMatchEnabled: false,
  defaultPresetId: null,
  matchRules: [],
};

const invalidatedTenantConfigKeys = new Set<string>();

function isAdminOrOwner(auth: TenantAuthContext): boolean {
  return auth.role === "admin" || auth.role === "owner";
}

function assertAdminOrOwner(auth: TenantAuthContext): void {
  if (!isAdminOrOwner(auth)) {
    throw new SettingsMutationForbiddenError();
  }
}

function migrationCacheKey(tenantId: string, configKey: string): string {
  return `${tenantId}:${configKey}`;
}

export function invalidateTenantConfig(tenantId: string, configKey: string): void {
  invalidatedTenantConfigKeys.add(migrationCacheKey(tenantId, configKey));
}

export function wasTenantConfigInvalidated(tenantId: string, configKey: string): boolean {
  return invalidatedTenantConfigKeys.has(migrationCacheKey(tenantId, configKey));
}

export function resetTenantConfigInvalidationForTests(): void {
  invalidatedTenantConfigKeys.clear();
}

function migrateWizardTemplatePayload(
  payload: Record<string, unknown>,
  storedVersion: number
): WizardTemplatePayloadV1 {
  if (storedVersion >= WIZARD_TEMPLATE_CURRENT_VERSION) {
    return normalizeWizardTemplatePayload(payload);
  }
  const migrated: WizardTemplatePayloadV1 = {
    seedLabel: typeof payload.seedLabel === "string" ? payload.seedLabel : "",
    sections: Array.isArray(payload.sections)
      ? payload.sections
          .filter((section): section is Record<string, unknown> => typeof section === "object" && section !== null)
          .map((section) => ({
            id: typeof section.id === "string" ? section.id : "section",
            label: typeof section.label === "string" ? section.label : "Section",
            enabled: section.enabled !== false,
          }))
      : WIZARD_TEMPLATE_WORKSPACE_DEFAULT.sections.map((section) => ({ ...section })),
  };
  if (migrated.sections.length === 0) {
    return { ...WIZARD_TEMPLATE_WORKSPACE_DEFAULT };
  }
  return migrated;
}

function normalizeWizardTemplateSteps(raw: unknown): WizardTemplatePayloadV1["steps"] {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const steps = raw
    .filter((step): step is Record<string, unknown> => typeof step === "object" && step !== null)
    .map((step) => ({
      stepId: typeof step.stepId === "string" ? step.stepId : "step",
      label: typeof step.label === "string" ? step.label : "Step",
      enabled: step.enabled !== false,
      fields: Array.isArray(step.fields)
        ? step.fields
            .filter(
              (field): field is Record<string, unknown> =>
                typeof field === "object" && field !== null
            )
            .map((field) => ({
              canonicalPath:
                typeof field.canonicalPath === "string" ? field.canonicalPath.trim() : "",
              ...(field.required === true ? { required: true } : {}),
              ...(field.hidden === true ? { hidden: true } : {}),
              ...(typeof field.defaultValue === "string"
                ? { defaultValue: field.defaultValue }
                : {}),
            }))
            .filter((field) => field.canonicalPath.length > 0)
        : [],
    }));
  return steps.length > 0 ? steps : undefined;
}

function normalizeFieldRulesOverlay(raw: unknown): WizardTemplatePayloadV1["fieldRulesOverlay"] {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const entries = Object.entries(raw as Record<string, unknown>).filter(
    ([key, value]) => key.trim().length > 0 && value != null && typeof value === "object" && !Array.isArray(value)
  );
  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

function normalizeWizardTemplatePayload(payload: Record<string, unknown>): WizardTemplatePayloadV1 {
  const seedLabel = typeof payload.seedLabel === "string" ? payload.seedLabel : "";
  const sections = Array.isArray(payload.sections)
    ? payload.sections
        .filter((section): section is Record<string, unknown> => typeof section === "object" && section !== null)
        .map((section) => ({
          id: typeof section.id === "string" ? section.id : "section",
          label: typeof section.label === "string" ? section.label : "Section",
          enabled: section.enabled !== false,
        }))
    : WIZARD_TEMPLATE_WORKSPACE_DEFAULT.sections.map((section) => ({ ...section }));

  let normalized: WizardTemplatePayloadV1 = {
    seedLabel,
    sections: sections.length > 0 ? sections : WIZARD_TEMPLATE_WORKSPACE_DEFAULT.sections.map((s) => ({ ...s })),
  };

  const baseProfile =
    typeof payload.baseProfile === "string" ? payload.baseProfile.trim() : "";
  if (baseProfile.length > 0) {
    normalized = { ...normalized, baseProfile };
  }

  const fieldRulesOverlay = normalizeFieldRulesOverlay(payload.fieldRulesOverlay);
  if (fieldRulesOverlay !== undefined) {
    normalized = { ...normalized, fieldRulesOverlay };
  }

  if (payload.published === true) {
    normalized = {
      ...normalized,
      published: true,
      ...(normalizeWizardTemplateSteps(payload.steps) !== undefined
        ? { steps: normalizeWizardTemplateSteps(payload.steps) }
        : {}),
    };
  }

  return normalized;
}

export function normalizeWizardTemplatePayloadForPut(
  payload: Record<string, unknown>
): WizardTemplatePayloadV1 {
  return normalizeWizardTemplatePayload(payload);
}

function normalizeMatchRule(raw: Record<string, unknown>): PresetsAdvancedMatchRule | null {
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (id.length === 0) {
    return null;
  }
  const tourType =
    raw.tourType === null ? null : typeof raw.tourType === "string" ? raw.tourType.trim() || null : null;
  const themeId =
    raw.themeId === null ? null : typeof raw.themeId === "string" ? raw.themeId.trim() || null : null;
  const presetId =
    raw.presetId === null ? null : typeof raw.presetId === "string" ? raw.presetId.trim() || null : null;
  return {
    id,
    tourType,
    themeId,
    presetId,
    enabled: raw.enabled !== false,
  };
}

function migratePresetsAdvancedPayload(
  payload: Record<string, unknown>,
  storedVersion: number
): PresetsAdvancedPayloadV1 {
  if (storedVersion >= PRESETS_ADVANCED_CURRENT_VERSION) {
    return normalizePresetsAdvancedPayload(payload);
  }
  return normalizePresetsAdvancedPayload(payload);
}

function normalizePresetsAdvancedPayload(payload: Record<string, unknown>): PresetsAdvancedPayloadV1 {
  const autoMatchEnabled = payload.autoMatchEnabled === true;
  const defaultPresetId =
    payload.defaultPresetId === null
      ? null
      : typeof payload.defaultPresetId === "string"
        ? payload.defaultPresetId.trim() || null
        : null;
  const matchRules = Array.isArray(payload.matchRules)
    ? payload.matchRules
        .filter((rule): rule is Record<string, unknown> => typeof rule === "object" && rule !== null)
        .map((rule) => normalizeMatchRule(rule))
        .filter((rule): rule is PresetsAdvancedMatchRule => rule !== null)
    : [];

  return {
    autoMatchEnabled,
    defaultPresetId,
    matchRules,
  };
}

async function assertSupportedConfigKey(tenantId: string, configKey: string): Promise<void> {
  await resolveSettingsModuleByConfigKeyForTenant(tenantId, configKey);
}

async function getWizardTemplateConfig(
  auth: TenantAuthContext,
  configKey: string
): Promise<SettingsConfigResponse> {
  const repo = getSettingsConfigRepository();
  const stored = await repo.get(auth.tenantId, configKey);
  if (stored === null) {
    return {
      configKey,
      configVersion: WIZARD_TEMPLATE_CURRENT_VERSION,
      source: "workspace",
      payload: {
        ...WIZARD_TEMPLATE_WORKSPACE_DEFAULT,
        sections: WIZARD_TEMPLATE_WORKSPACE_DEFAULT.sections.map((s) => ({ ...s })),
      },
      updatedAt: null,
    };
  }

  const migratedPayload = migrateWizardTemplatePayload(
    stored.payload as unknown as Record<string, unknown>,
    stored.configVersion
  );

  return {
    configKey,
    configVersion: WIZARD_TEMPLATE_CURRENT_VERSION,
    source: "tenant",
    payload: migratedPayload,
    updatedAt: stored.updatedAt,
  };
}

async function getPresetsAdvancedConfig(
  auth: TenantAuthContext,
  configKey: string
): Promise<SettingsConfigResponse> {
  const repo = getSettingsConfigRepository();
  const stored = await repo.get(auth.tenantId, configKey);
  if (stored === null) {
    return {
      configKey,
      configVersion: PRESETS_ADVANCED_CURRENT_VERSION,
      source: "workspace",
      payload: { ...PRESETS_ADVANCED_WORKSPACE_DEFAULT, matchRules: [] },
      updatedAt: null,
    };
  }

  const migratedPayload = migratePresetsAdvancedPayload(
    stored.payload as unknown as Record<string, unknown>,
    stored.configVersion
  );

  return {
    configKey,
    configVersion: PRESETS_ADVANCED_CURRENT_VERSION,
    source: "tenant",
    payload: migratedPayload,
    updatedAt: stored.updatedAt,
  };
}

export async function getSettingsConfig(
  auth: TenantAuthContext,
  configKey: string
): Promise<SettingsConfigResponse> {
  await assertSettingsConfigWorkspaceAllowed(auth.tenantId, configKey);
  await assertSupportedConfigKey(auth.tenantId, configKey);
  if (configKey === "wizard_template") {
    return getWizardTemplateConfig(auth, configKey);
  }
  if (configKey === "presets_advanced") {
    return getPresetsAdvancedConfig(auth, configKey);
  }
  throw new SettingsConfigUnknownError(configKey);
}

async function putWizardTemplateConfig(
  auth: TenantAuthContext,
  configKey: string,
  body: PutSettingsConfigRequest
): Promise<SettingsConfigResponse> {
  const module = await resolveSettingsModuleByConfigKeyForTenant(auth.tenantId, configKey);
  const expectedVersion = module.configVersion ?? WIZARD_TEMPLATE_CURRENT_VERSION;
  if (body.configVersion !== expectedVersion) {
    throw new SettingsConfigVersionUnsupportedError(body.configVersion);
  }

  const payload = normalizeWizardTemplatePayload(body.payload as unknown as Record<string, unknown>);
  await assertWizardTemplateFieldsKnown(auth.tenantId, payload);
  const repo = getSettingsConfigRepository();
  const saved = await repo.put(auth.tenantId, configKey, {
    configVersion: expectedVersion,
    payload,
  });
  invalidateTenantConfig(auth.tenantId, configKey);
  await emitSettingsConfigAudit(auth, configKey, "Updated wizard template seed");

  return {
    configKey,
    configVersion: saved.configVersion,
    source: "tenant",
    payload: saved.payload,
    updatedAt: saved.updatedAt,
  };
}

async function putPresetsAdvancedConfig(
  auth: TenantAuthContext,
  configKey: string,
  body: PutSettingsConfigRequest
): Promise<SettingsConfigResponse> {
  const module = await resolveSettingsModuleByConfigKeyForTenant(auth.tenantId, configKey);
  const expectedVersion = module.configVersion ?? PRESETS_ADVANCED_CURRENT_VERSION;
  if (body.configVersion !== expectedVersion) {
    throw new SettingsConfigVersionUnsupportedError(body.configVersion);
  }

  const payload = normalizePresetsAdvancedPayload(body.payload as unknown as Record<string, unknown>);
  const repo = getSettingsConfigRepository();
  const saved = await repo.put(auth.tenantId, configKey, {
    configVersion: expectedVersion,
    payload,
  });
  invalidateTenantConfig(auth.tenantId, configKey);
  await emitSettingsConfigAudit(auth, configKey, "Updated advanced tour presets");

  return {
    configKey,
    configVersion: saved.configVersion,
    source: "tenant",
    payload: saved.payload,
    updatedAt: saved.updatedAt,
  };
}

export async function putSettingsConfig(
  auth: TenantAuthContext,
  configKey: string,
  body: PutSettingsConfigRequest
): Promise<SettingsConfigResponse> {
  await assertSettingsConfigWorkspaceAllowed(auth.tenantId, configKey);
  assertAdminOrOwner(auth);
  await assertSupportedConfigKey(auth.tenantId, configKey);
  if (configKey === "wizard_template") {
    return putWizardTemplateConfig(auth, configKey, body);
  }
  if (configKey === "presets_advanced") {
    return putPresetsAdvancedConfig(auth, configKey, body);
  }
  throw new SettingsConfigUnknownError(configKey);
}

export { SettingsConfigUnknownError };
