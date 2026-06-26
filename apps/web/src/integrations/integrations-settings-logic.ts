import type {
  IntegrationConnectionPublic,
  IntegrationProviderSurfaceMeta,
  WorkspaceIntegrationSurfaceMetaResponse,
  WorkspaceIntegrationsListResponse,
} from "@/integrations/integrations-types";

export type IntegrationPatchInput = {
  readonly config?: Record<string, string>;
  readonly credentials?: Record<string, string>;
};

export type IntegrationsWorkspaceScenario =
  | "empty"
  | "legacy_only"
  | "migration_ready"
  | "active_new_system";

export type IntegrationFallbackLabel = "active" | "suppressed" | "inactive" | "not_applicable";

export function resolveIntegrationsWorkspaceScenario(
  list: WorkspaceIntegrationsListResponse
): IntegrationsWorkspaceScenario {
  const { integrationConnectionCount, legacyConnectionCount } = list.summary;
  if (integrationConnectionCount === 0 && legacyConnectionCount === 0) {
    return "empty";
  }
  if (integrationConnectionCount === 0 && legacyConnectionCount > 0) {
    return "legacy_only";
  }
  if (integrationConnectionCount > 0 && legacyConnectionCount > 0) {
    return "migration_ready";
  }
  return "active_new_system";
}

export function resolveIntegrationFallbackLabel(
  item: IntegrationConnectionPublic
): IntegrationFallbackLabel {
  if (item.backingSource !== "legacy_workspace_telegram_bot") {
    return "not_applicable";
  }
  if (item.fallbackSuppressed) {
    return "suppressed";
  }
  if (item.isActiveDeliverySource) {
    return "active";
  }
  return "inactive";
}

export function integrationStatusBadgeKey(
  item: IntegrationConnectionPublic
): "enabled" | "disabled" | "error" {
  if (item.status === "error") {
    return "error";
  }
  if (item.enabled) {
    return "enabled";
  }
  return "disabled";
}

export function isLegacyBackedIntegration(item: IntegrationConnectionPublic): boolean {
  return item.backingSource === "legacy_workspace_telegram_bot";
}

export function hasPlatformTelegramConnection(
  list: WorkspaceIntegrationsListResponse | null
): boolean {
  return hasPlatformIntegrationConnection(list, "telegram");
}

export function hasPlatformIntegrationConnection(
  list: WorkspaceIntegrationsListResponse | null,
  providerId: string
): boolean {
  return (
    list?.items.some(
      (item) => item.provider === providerId && item.backingSource === "integration_connection"
    ) ?? false
  );
}

export function channelIdFromConfig(config: Record<string, unknown>): string {
  return typeof config.channelId === "string" ? config.channelId : "—";
}

export function shouldShowIntegrationsScenarioCard(
  scenario: IntegrationsWorkspaceScenario | null
): boolean {
  return scenario !== null && scenario !== "empty";
}

export function findProviderSurfaceMeta(
  meta: WorkspaceIntegrationSurfaceMetaResponse | null,
  providerId: string
): IntegrationProviderSurfaceMeta | null {
  return meta?.providers.find((provider) => provider.id === providerId) ?? null;
}

export function integrationEditFieldKey(scope: "config" | "credentials", fieldId: string): string {
  return `${scope}.${fieldId}`;
}

export function seedEditValuesFromConnection(
  item: IntegrationConnectionPublic,
  provider: IntegrationProviderSurfaceMeta
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of provider.configFields) {
    const current = item.config[field.id];
    if (typeof current === "string") {
      values[integrationEditFieldKey("config", field.id)] = current;
    }
  }
  return values;
}

export function hasRequiredEditConfigFields(
  provider: IntegrationProviderSurfaceMeta,
  editValues: Record<string, string>
): boolean {
  return provider.configFields.every(
    (field) => (editValues[integrationEditFieldKey("config", field.id)] ?? "").trim().length > 0
  );
}

export function hasActiveTelegramDeliverySource(
  list: WorkspaceIntegrationsListResponse | null
): boolean {
  return (
    list?.items.some((item) => item.provider === "telegram" && item.isActiveDeliverySource) ?? false
  );
}

export function buildIntegrationPatchInput(
  provider: IntegrationProviderSurfaceMeta,
  currentConfig: Record<string, unknown>,
  editValues: Record<string, string>
): IntegrationPatchInput | null {
  const config: Record<string, string> = {};
  let configChanged = false;

  for (const field of provider.configFields) {
    const key = integrationEditFieldKey("config", field.id);
    const next = (editValues[key] ?? "").trim();
    const previous =
      typeof currentConfig[field.id] === "string" ? currentConfig[field.id].trim() : "";
    if (next !== previous) {
      configChanged = true;
    }
    if (next.length > 0) {
      config[field.id] = next;
    }
  }

  const credentials = Object.fromEntries(
    provider.credentialFields
      .map((field) => {
        const value = (editValues[integrationEditFieldKey("credentials", field.id)] ?? "").trim();
        return [field.id, value] as const;
      })
      .filter(([, value]) => value.length > 0)
  );

  if (!configChanged && Object.keys(credentials).length === 0) {
    return null;
  }

  const payload: IntegrationPatchInput = {};
  if (configChanged) {
    payload.config = config;
  }
  if (Object.keys(credentials).length > 0) {
    payload.credentials = credentials;
  }
  return payload;
}
