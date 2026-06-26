export type IntegrationBackingSource = "integration_connection" | "legacy_workspace_telegram_bot";

export type IntegrationActionsAllowed = {
  readonly enable: boolean;
  readonly disable: boolean;
  readonly test: boolean;
  readonly patch: boolean;
  readonly delete: boolean;
};

export type IntegrationConnectionPublic = {
  readonly id: string;
  readonly tenantId: string;
  readonly workspaceType: string | null;
  readonly provider: string;
  readonly status: string;
  readonly enabled: boolean;
  readonly capabilities: readonly string[];
  readonly config: Record<string, unknown>;
  readonly hasSecret: boolean;
  readonly secretRefMasked: string | null;
  readonly eventPolicies: readonly {
    readonly eventType: string;
    readonly enabled: boolean;
  }[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly backingSource: IntegrationBackingSource;
  readonly legacySourceId: string | null;
  readonly actionsAllowed: IntegrationActionsAllowed;
  readonly isActiveDeliverySource: boolean;
  readonly fallbackSuppressed: boolean;
};

export type WorkspaceIntegrationsListResponse = {
  readonly items: readonly IntegrationConnectionPublic[];
  readonly summary: {
    readonly integrationConnectionCount: number;
    readonly legacyConnectionCount: number;
    readonly activeDeliverySource: IntegrationBackingSource | null;
  };
};

export type IntegrationTestConnectionResult = {
  readonly ok: boolean;
  readonly code?: string;
  readonly message?: string;
  readonly testedAt: string;
  readonly backingSource: IntegrationBackingSource;
};

export type IntegrationSurfaceFieldMeta = {
  readonly id: string;
  readonly kind: "string" | "secret";
  readonly requiredOnCreate: boolean;
};

export type IntegrationProviderSurfaceMeta = {
  readonly id: string;
  readonly configFields: readonly IntegrationSurfaceFieldMeta[];
  readonly credentialFields: readonly IntegrationSurfaceFieldMeta[];
  readonly defaultCapabilities: readonly string[];
};

export type WorkspaceIntegrationSurfaceMetaResponse = {
  readonly workspaceType: string | null;
  readonly providers: readonly IntegrationProviderSurfaceMeta[];
};

export function parseWorkspaceIntegrationsListResponse(
  payload: unknown
): WorkspaceIntegrationsListResponse {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("INTEGRATIONS_LIST_INVALID");
  }
  const record = payload as Record<string, unknown>;
  const itemsRaw = Array.isArray(record.items) ? record.items : [];
  const summaryRaw =
    typeof record.summary === "object" && record.summary !== null
      ? (record.summary as Record<string, unknown>)
      : {};

  return {
    items: itemsRaw.map(parseIntegrationConnectionPublic),
    summary: {
      integrationConnectionCount:
        typeof summaryRaw.integrationConnectionCount === "number"
          ? summaryRaw.integrationConnectionCount
          : 0,
      legacyConnectionCount:
        typeof summaryRaw.legacyConnectionCount === "number" ? summaryRaw.legacyConnectionCount : 0,
      activeDeliverySource:
        summaryRaw.activeDeliverySource === "integration_connection" ||
        summaryRaw.activeDeliverySource === "legacy_workspace_telegram_bot"
          ? summaryRaw.activeDeliverySource
          : null,
    },
  };
}

export function parseIntegrationConnectionPublic(payload: unknown): IntegrationConnectionPublic {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("INTEGRATION_INVALID");
  }
  const record = payload as Record<string, unknown>;
  const actionsRaw =
    typeof record.actionsAllowed === "object" && record.actionsAllowed !== null
      ? (record.actionsAllowed as Record<string, unknown>)
      : {};

  return {
    id: typeof record.id === "string" ? record.id : "",
    tenantId: typeof record.tenantId === "string" ? record.tenantId : "",
    workspaceType: typeof record.workspaceType === "string" ? record.workspaceType : null,
    provider: typeof record.provider === "string" ? record.provider : "telegram",
    status: typeof record.status === "string" ? record.status : "disabled",
    enabled: record.enabled === true,
    capabilities: Array.isArray(record.capabilities)
      ? record.capabilities.filter((entry): entry is string => typeof entry === "string")
      : [],
    config:
      typeof record.config === "object" && record.config !== null
        ? (record.config as Record<string, unknown>)
        : {},
    hasSecret: record.hasSecret === true,
    secretRefMasked: typeof record.secretRefMasked === "string" ? record.secretRefMasked : null,
    eventPolicies: Array.isArray(record.eventPolicies)
      ? record.eventPolicies
          .filter(
            (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null
          )
          .map((entry) => ({
            eventType: typeof entry.eventType === "string" ? entry.eventType : "",
            enabled: entry.enabled === true,
          }))
      : [],
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
    backingSource:
      record.backingSource === "legacy_workspace_telegram_bot"
        ? "legacy_workspace_telegram_bot"
        : "integration_connection",
    legacySourceId: typeof record.legacySourceId === "string" ? record.legacySourceId : null,
    actionsAllowed: {
      enable: actionsRaw.enable === true,
      disable: actionsRaw.disable === true,
      test: actionsRaw.test === true,
      patch: actionsRaw.patch === true,
      delete: actionsRaw.delete === true,
    },
    isActiveDeliverySource: record.isActiveDeliverySource === true,
    fallbackSuppressed: record.fallbackSuppressed === true,
  };
}

export function parseIntegrationTestConnectionResult(
  payload: unknown
): IntegrationTestConnectionResult {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("INTEGRATION_TEST_INVALID");
  }
  const record = payload as Record<string, unknown>;
  return {
    ok: record.ok === true,
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    testedAt: typeof record.testedAt === "string" ? record.testedAt : new Date().toISOString(),
    backingSource:
      record.backingSource === "legacy_workspace_telegram_bot"
        ? "legacy_workspace_telegram_bot"
        : "integration_connection",
  };
}

function parseIntegrationSurfaceFieldMeta(payload: unknown): IntegrationSurfaceFieldMeta {
  const record =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  return {
    id: typeof record.id === "string" ? record.id : "",
    kind: record.kind === "secret" ? "secret" : "string",
    requiredOnCreate: record.requiredOnCreate === true,
  };
}

function parseIntegrationProviderSurfaceMeta(payload: unknown): IntegrationProviderSurfaceMeta {
  const record =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  return {
    id: typeof record.id === "string" ? record.id : "",
    configFields: Array.isArray(record.configFields)
      ? record.configFields.map(parseIntegrationSurfaceFieldMeta).filter((field) => field.id !== "")
      : [],
    credentialFields: Array.isArray(record.credentialFields)
      ? record.credentialFields
          .map(parseIntegrationSurfaceFieldMeta)
          .filter((field) => field.id !== "")
      : [],
    defaultCapabilities: Array.isArray(record.defaultCapabilities)
      ? record.defaultCapabilities.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

export function parseWorkspaceIntegrationSurfaceMetaResponse(
  payload: unknown
): WorkspaceIntegrationSurfaceMetaResponse {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("INTEGRATION_META_INVALID");
  }
  const record = payload as Record<string, unknown>;
  return {
    workspaceType: typeof record.workspaceType === "string" ? record.workspaceType : null,
    providers: Array.isArray(record.providers)
      ? record.providers
          .map(parseIntegrationProviderSurfaceMeta)
          .filter((provider) => provider.id !== "")
      : [],
  };
}
