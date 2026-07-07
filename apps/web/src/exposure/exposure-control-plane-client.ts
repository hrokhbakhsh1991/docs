export type ExposureControlPlaneFieldDecision = {
  readonly fieldId: string;
  readonly state: "visible" | "hidden" | "redacted" | "summary_only" | "blocked";
  readonly reasonChain: readonly string[];
  readonly appliedPolicies: readonly string[];
};

export type ExposureControlPlaneProfile = {
  readonly id: string;
  readonly workspaceType: string;
  readonly entityType: string;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly defaultFieldIds: readonly string[];
  readonly defaultTemplateId?: string;
  readonly source: string;
  readonly version: string;
};

export type ExposureControlPlaneIntent = {
  readonly id?: string;
  readonly profileId?: string;
  readonly workspaceType: string;
  readonly mode: "inherit_profile" | "override_fields" | "disabled";
  readonly selectedFieldIds: readonly string[];
  readonly templateOverrideId?: string;
  readonly surface?: string;
  readonly audience?: string;
  readonly trigger?: string;
  readonly scope: Readonly<Record<string, unknown>>;
};

export type ExposureControlPlaneEventContext = {
  readonly eventType: string;
  readonly eventPolicyEnabled: boolean;
  readonly storedContext: {
    readonly surface: string;
    readonly audience: string;
    readonly trigger: string;
  } | null;
  readonly effectiveContext: {
    readonly surface: string;
    readonly audience: string;
    readonly trigger: string;
  };
  readonly storedDiffersFromEffective: boolean;
  readonly coordinateControlsRuntimeEffective: boolean;
  readonly seededProfile: ExposureControlPlaneProfile | null;
  readonly persistedProfile: ExposureControlPlaneProfile | null;
  readonly activeExposureIntent: ExposureControlPlaneIntent | null;
  readonly enginePreview: {
    readonly samplePayload: Readonly<Record<string, unknown>>;
    readonly decisions: readonly ExposureControlPlaneFieldDecision[];
    readonly engineSelectedFieldIds: readonly string[];
  } | null;
};

export type ExposureControlPlaneConnection = {
  readonly connectionId: string;
  readonly provider: string;
  readonly enabled: boolean;
  readonly backingSource: string;
  readonly contexts: readonly ExposureControlPlaneEventContext[];
};

export type WorkspaceExposureControlPlaneResponse = {
  readonly workspaceType: string;
  readonly runtime: {
    readonly fieldExposureRuntimeMode: "shadow" | "cutover";
    readonly forwardEngineShadowEnabled: boolean;
    readonly activeDeliverySelector: "engine_selected_field_ids";
    readonly parityInstrumentation: "forward_engine_shadow" | "legacy_mirror_shadow" | "none";
  };
  readonly connections: readonly ExposureControlPlaneConnection[];
};

function parseProfile(payload: unknown): ExposureControlPlaneProfile | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  if (id === "") {
    return null;
  }
  return {
    id,
    workspaceType: typeof record.workspaceType === "string" ? record.workspaceType : "",
    entityType: typeof record.entityType === "string" ? record.entityType : "",
    surface: typeof record.surface === "string" ? record.surface : "",
    audience: typeof record.audience === "string" ? record.audience : "",
    trigger: typeof record.trigger === "string" ? record.trigger : "",
    defaultFieldIds: Array.isArray(record.defaultFieldIds)
      ? record.defaultFieldIds.filter((entry): entry is string => typeof entry === "string")
      : [],
    ...(typeof record.defaultTemplateId === "string" && record.defaultTemplateId.length > 0
      ? { defaultTemplateId: record.defaultTemplateId }
      : {}),
    source: typeof record.source === "string" ? record.source : "unknown",
    version: typeof record.version === "string" ? record.version : "",
  };
}

function parseIntent(payload: unknown): ExposureControlPlaneIntent | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const mode =
    record.mode === "override_fields" || record.mode === "disabled"
      ? record.mode
      : "inherit_profile";
  return {
    ...(typeof record.id === "string" ? { id: record.id } : {}),
    ...(typeof record.profileId === "string" ? { profileId: record.profileId } : {}),
    workspaceType: typeof record.workspaceType === "string" ? record.workspaceType : "",
    mode,
    selectedFieldIds: Array.isArray(record.selectedFieldIds)
      ? record.selectedFieldIds.filter((entry): entry is string => typeof entry === "string")
      : [],
    ...(typeof record.templateOverrideId === "string" && record.templateOverrideId.length > 0
      ? { templateOverrideId: record.templateOverrideId }
      : {}),
    ...(typeof record.surface === "string" ? { surface: record.surface } : {}),
    ...(typeof record.audience === "string" ? { audience: record.audience } : {}),
    ...(typeof record.trigger === "string" ? { trigger: record.trigger } : {}),
    scope:
      typeof record.scope === "object" && record.scope !== null
        ? (record.scope as Readonly<Record<string, unknown>>)
        : {},
  };
}

function parseDecision(payload: unknown): ExposureControlPlaneFieldDecision | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const fieldId = typeof record.fieldId === "string" ? record.fieldId : "";
  const state = record.state;
  if (
    fieldId === "" ||
    (state !== "visible" &&
      state !== "hidden" &&
      state !== "redacted" &&
      state !== "summary_only" &&
      state !== "blocked")
  ) {
    return null;
  }
  return {
    fieldId,
    state,
    reasonChain: Array.isArray(record.reasonChain)
      ? record.reasonChain.filter((entry): entry is string => typeof entry === "string")
      : [],
    appliedPolicies: Array.isArray(record.appliedPolicies)
      ? record.appliedPolicies.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

function parseContextTriple(payload: unknown): {
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
} | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  return {
    surface: typeof record.surface === "string" ? record.surface : "",
    audience: typeof record.audience === "string" ? record.audience : "",
    trigger: typeof record.trigger === "string" ? record.trigger : "",
  };
}

function parseEventContext(payload: unknown): ExposureControlPlaneEventContext | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const eventType = typeof record.eventType === "string" ? record.eventType : "";
  if (eventType === "") {
    return null;
  }
  const storedContext = parseContextTriple(record.storedContext);
  const effectiveContext = parseContextTriple(record.effectiveContext) ?? {
    surface: "",
    audience: "",
    trigger: "",
  };
  const enginePreviewRaw =
    typeof record.enginePreview === "object" && record.enginePreview !== null
      ? (record.enginePreview as Record<string, unknown>)
      : null;

  return {
    eventType,
    eventPolicyEnabled: record.eventPolicyEnabled === true,
    storedContext,
    effectiveContext,
    storedDiffersFromEffective: record.storedDiffersFromEffective === true,
    coordinateControlsRuntimeEffective: record.coordinateControlsRuntimeEffective === true,
    seededProfile: parseProfile(record.seededProfile),
    persistedProfile: parseProfile(record.persistedProfile),
    activeExposureIntent: parseIntent(record.activeExposureIntent),
    enginePreview:
      enginePreviewRaw === null
        ? null
        : {
            samplePayload:
              typeof enginePreviewRaw.samplePayload === "object" &&
              enginePreviewRaw.samplePayload !== null
                ? (enginePreviewRaw.samplePayload as Readonly<Record<string, unknown>>)
                : {},
            decisions: Array.isArray(enginePreviewRaw.decisions)
              ? enginePreviewRaw.decisions
                  .map(parseDecision)
                  .filter((entry): entry is ExposureControlPlaneFieldDecision => entry !== null)
              : [],
            engineSelectedFieldIds: Array.isArray(enginePreviewRaw.engineSelectedFieldIds)
              ? enginePreviewRaw.engineSelectedFieldIds.filter(
                  (entry): entry is string => typeof entry === "string",
                )
              : [],
          },
  };
}

export function parseWorkspaceExposureControlPlaneResponse(
  payload: unknown,
): WorkspaceExposureControlPlaneResponse {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("EXPOSURE_CONTROL_PLANE_INVALID");
  }
  const record = payload as Record<string, unknown>;
  const runtime =
    typeof record.runtime === "object" && record.runtime !== null
      ? (record.runtime as Record<string, unknown>)
      : {};
  const runtimeMode = runtime.fieldExposureRuntimeMode === "cutover" ? "cutover" : "shadow";
  const parityInstrumentation =
    runtime.parityInstrumentation === "forward_engine_shadow" ||
    runtime.parityInstrumentation === "legacy_mirror_shadow"
      ? runtime.parityInstrumentation
      : "none";

  return {
    workspaceType: typeof record.workspaceType === "string" ? record.workspaceType : "",
    runtime: {
      fieldExposureRuntimeMode: runtimeMode,
      forwardEngineShadowEnabled: runtime.forwardEngineShadowEnabled === true,
      activeDeliverySelector: "engine_selected_field_ids",
      parityInstrumentation,
    },
    connections: Array.isArray(record.connections)
      ? record.connections
          .map((entry) => {
            if (typeof entry !== "object" || entry === null) {
              return null;
            }
            const connection = entry as Record<string, unknown>;
            const connectionId =
              typeof connection.connectionId === "string" ? connection.connectionId : "";
            if (connectionId === "") {
              return null;
            }
            return {
              connectionId,
              provider: typeof connection.provider === "string" ? connection.provider : "",
              enabled: connection.enabled === true,
              backingSource:
                typeof connection.backingSource === "string" ? connection.backingSource : "",
              contexts: Array.isArray(connection.contexts)
                ? connection.contexts
                    .map(parseEventContext)
                    .filter((ctx): ctx is ExposureControlPlaneEventContext => ctx !== null)
                : [],
            };
          })
          .filter((entry): entry is ExposureControlPlaneConnection => entry !== null)
      : [],
  };
}

export async function fetchWorkspaceExposureControlPlane(
  workspaceId: string,
): Promise<WorkspaceExposureControlPlaneResponse> {
  const res = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/exposure/control-plane`,
    { cache: "no-store" },
  );
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code =
      typeof payload.code === "string"
        ? payload.code
        : `EXPOSURE_CONTROL_PLANE_HTTP_${res.status}`;
    throw new Error(code);
  }
  return parseWorkspaceExposureControlPlaneResponse(payload);
}
