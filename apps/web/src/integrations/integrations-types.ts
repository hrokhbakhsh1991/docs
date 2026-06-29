export type IntegrationBackingSource = "integration_connection" | "legacy_workspace_telegram_bot";

export type IntegrationActionsAllowed = {
  readonly enable: boolean;
  readonly disable: boolean;
  readonly test: boolean;
  readonly patch: boolean;
  readonly delete: boolean;
};

export type ExposureFieldDecoration = {
  readonly prefix: string;
};

export type ExposureFieldDecorations = Readonly<Record<string, ExposureFieldDecoration>>;

export type ExposureIntentPublic = {
  readonly id: string;
  readonly workspaceType: string;
  readonly connectionId: string;
  readonly eventType: string;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly selectedFieldIds: readonly string[];
  readonly fieldDecorations?: ExposureFieldDecorations;
  readonly templateId?: string;
  readonly routeScoped: boolean;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type IntegrationConnectionLoadWarning =
  | "POLICIES_UNAVAILABLE"
  | "EXPOSURE_INTENTS_UNAVAILABLE";

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
  readonly exposureIntents: readonly ExposureIntentPublic[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly backingSource: IntegrationBackingSource;
  readonly legacySourceId: string | null;
  readonly actionsAllowed: IntegrationActionsAllowed;
  readonly isActiveDeliverySource: boolean;
  readonly fallbackSuppressed: boolean;
  readonly loadWarnings?: readonly IntegrationConnectionLoadWarning[];
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

export type IntegrationEventPolicySurfaceMeta = {
  readonly eventType: string;
  readonly enabled: boolean;
};

export type IntegrationProviderSurfaceMeta = {
  readonly id: string;
  readonly configFields: readonly IntegrationSurfaceFieldMeta[];
  readonly credentialFields: readonly IntegrationSurfaceFieldMeta[];
  readonly defaultCapabilities: readonly string[];
  readonly defaultEventPolicies: readonly IntegrationEventPolicySurfaceMeta[];
};

export type IntegrationDeliveryCandidateFieldMeta = {
  readonly id: string;
  readonly canonicalPath: string;
  readonly kind: "text" | "number" | "date" | "enum" | "boolean" | "composite";
  readonly tags?: readonly string[];
  readonly adminLabel?: string;
  readonly adminDescription?: string;
  readonly group?: string;
  readonly icon?: string;
};

export type WorkspaceIntegrationSurfaceMetaResponse = {
  readonly workspaceType: string | null;
  readonly providers: readonly IntegrationProviderSurfaceMeta[];
  readonly exposureCandidateFields: readonly IntegrationDeliveryCandidateFieldMeta[];
};

function parseExposureIntentPublic(payload: unknown): ExposureIntentPublic | null {
  const record =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const id = typeof record.id === "string" ? record.id : "";
  const connectionId = typeof record.connectionId === "string" ? record.connectionId : "";
  const eventType = typeof record.eventType === "string" ? record.eventType : "";
  if (id === "" || connectionId === "" || eventType === "") {
    return null;
  }
  const trigger =
    typeof record.trigger === "string" && record.trigger.trim().length > 0
      ? record.trigger.trim()
      : eventType;
  const surface =
    typeof record.surface === "string" && record.surface.trim().length > 0
      ? record.surface.trim()
      : "unknown";
  const audience =
    typeof record.audience === "string" && record.audience.trim().length > 0
      ? record.audience.trim()
      : "external_channel";
  const parsedFieldDecorations =
    typeof record.fieldDecorations === "object" &&
    record.fieldDecorations !== null &&
    !Array.isArray(record.fieldDecorations)
      ? Object.fromEntries(
          Object.entries(record.fieldDecorations as Record<string, unknown>)
            .map(([fieldId, value]) => {
              if (typeof value !== "object" || value === null || Array.isArray(value)) {
                return null;
              }
              const prefix = (value as Record<string, unknown>).prefix;
              if (typeof prefix !== "string" || prefix.trim().length === 0) {
                return null;
              }
              return [fieldId, { prefix: prefix.trim() }] as const;
            })
            .filter(
              (entry): entry is readonly [string, ExposureFieldDecoration] => entry !== null,
            ),
        )
      : {};
  return {
    id,
    workspaceType: typeof record.workspaceType === "string" ? record.workspaceType : "",
    connectionId,
    eventType,
    surface,
    audience,
    trigger,
    selectedFieldIds: Array.isArray(record.selectedFieldIds)
      ? record.selectedFieldIds.filter((fieldId): fieldId is string => typeof fieldId === "string")
      : [],
    ...(Object.keys(parsedFieldDecorations).length > 0
      ? { fieldDecorations: parsedFieldDecorations }
      : {}),
    ...(typeof record.templateId === "string" && record.templateId.trim().length > 0
      ? { templateId: record.templateId.trim() }
      : {}),
    routeScoped: record.routeScoped === true,
    enabled: record.enabled === true,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
}

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
    exposureIntents: (Array.isArray(record.exposureIntents)
      ? record.exposureIntents
      : Array.isArray(record.deliveryIntents)
        ? record.deliveryIntents
        : []
    )
      .filter(
        (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
      )
      .map(parseExposureIntentPublic)
      .filter((intent): intent is ExposureIntentPublic => intent !== null),
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
    ...(Array.isArray(record.loadWarnings) && record.loadWarnings.length > 0
      ? {
          loadWarnings: record.loadWarnings.filter(
            (entry): entry is IntegrationConnectionLoadWarning =>
              entry === "POLICIES_UNAVAILABLE" || entry === "EXPOSURE_INTENTS_UNAVAILABLE",
          ),
        }
      : {}),
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
    defaultEventPolicies: Array.isArray(record.defaultEventPolicies)
      ? record.defaultEventPolicies
          .filter(
            (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null
          )
          .map((entry) => ({
            eventType: typeof entry.eventType === "string" ? entry.eventType : "",
            enabled: entry.enabled === true,
          }))
          .filter((entry) => entry.eventType !== "")
      : [],
  };
}

function parseIntegrationDeliveryCandidateFieldMeta(
  payload: unknown
): IntegrationDeliveryCandidateFieldMeta | null {
  const record =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const kind =
    record.kind === "number" ||
    record.kind === "date" ||
    record.kind === "enum" ||
    record.kind === "boolean" ||
    record.kind === "composite"
      ? record.kind
      : "text";
  const id = typeof record.id === "string" ? record.id : "";
  if (id === "") {
    return null;
  }
  return {
    id,
    canonicalPath: typeof record.canonicalPath === "string" ? record.canonicalPath : id,
    kind,
    ...(Array.isArray(record.tags)
      ? {
          tags: record.tags.filter((tag): tag is string => typeof tag === "string"),
        }
      : {}),
    ...(typeof record.adminLabel === "string" && record.adminLabel.trim().length > 0
      ? { adminLabel: record.adminLabel.trim() }
      : {}),
    ...(typeof record.adminDescription === "string" && record.adminDescription.trim().length > 0
      ? { adminDescription: record.adminDescription.trim() }
      : {}),
    ...(typeof record.group === "string" && record.group.trim().length > 0
      ? { group: record.group.trim() }
      : {}),
    ...(typeof record.icon === "string" && record.icon.trim().length > 0
      ? { icon: record.icon.trim() }
      : {}),
  };
}

export function parseWorkspaceIntegrationSurfaceMetaResponse(
  payload: unknown
): WorkspaceIntegrationSurfaceMetaResponse {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("INTEGRATION_META_INVALID");
  }
  const record = payload as Record<string, unknown>;
  // Phase 7g: response no longer carries `deliveryCandidateFields`. Keep a one-way READ
  // fallback from the legacy key so older API payloads still hydrate; never re-emit it.
  const exposureCandidateFieldsRaw = Array.isArray(record.exposureCandidateFields)
    ? record.exposureCandidateFields
    : Array.isArray(record.deliveryCandidateFields)
      ? record.deliveryCandidateFields
      : [];
  const exposureCandidateFields = exposureCandidateFieldsRaw
    .map(parseIntegrationDeliveryCandidateFieldMeta)
    .filter((field): field is IntegrationDeliveryCandidateFieldMeta => field !== null);
  return {
    workspaceType: typeof record.workspaceType === "string" ? record.workspaceType : null,
    providers: Array.isArray(record.providers)
      ? record.providers
          .map(parseIntegrationProviderSurfaceMeta)
          .filter((provider) => provider.id !== "")
      : [],
    exposureCandidateFields,
  };
}
