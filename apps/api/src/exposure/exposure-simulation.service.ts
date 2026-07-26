import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { resolveIntegrationPolicyExposureCoordinate } from "../integrations/application/integration-policy-engine";
import { getIntegrationDetail } from "../integrations/http/integrations.service";

import {
  buildConnectionExposureIntentScope,
  resolveConnectionExposureIntentForRoute,
} from "./connection-exposure-intent-scope";
import {
  buildDeterministicExposureEnginePreview,
  type ExposureEnginePreviewFieldDecision,
  type ExposureEnginePreviewResponse,
} from "./exposure-engine-preview.service";
import {
  NATIVE_EXPOSURE_INTENT_SOURCE,
  type ExposureIntent,
  type ExposureIntentMode,
} from "./exposure-intent";
import type { ExposureProfile } from "./exposure-profile";
import { resolveLegacyDeliveryExposureProfile } from "./legacy-delivery-exposure-mapper";
import { resolvePersistedExposureProfileForContext } from "./resolve-persisted-exposure-profile";
import { createExposureIntentRepository } from "./prisma-exposure-intent.repository";
import type { FieldExposureRuntimeCoordinate } from "./resolve-runtime-truth-source";

export class ExposureSimulationInvalidBodyError extends Error {
  readonly code = "EXPOSURE_SIMULATION_INVALID_BODY";
  constructor(message: string) {
    super(message);
    this.name = "ExposureSimulationInvalidBodyError";
  }
}

export type ExposureSimulationDraftIntent = {
  readonly mode: ExposureIntentMode;
  readonly selectedFieldIds: readonly string[];
  readonly templateOverrideId?: string;
};

export type ExposureSimulationRequest = {
  readonly connectionId: string;
  readonly eventType: string;
  readonly draftIntent?: ExposureSimulationDraftIntent;
};

export type ExposureSimulationResponse = {
  readonly samplePayload: ExposureEnginePreviewResponse["samplePayload"];
  readonly fields: ExposureEnginePreviewResponse["fields"];
  readonly summary: ExposureEnginePreviewResponse["summary"];
  readonly simulation: {
    readonly connectionId: string;
    readonly eventType: string;
    readonly effectiveContext: FieldExposureRuntimeCoordinate;
    readonly draftIntentApplied: boolean;
  };
};

export type ExposureSimulationDiffResponse = {
  readonly current: ExposureSimulationResponse;
  readonly simulated: ExposureSimulationResponse;
  readonly diff: {
    readonly changedFieldIds: readonly string[];
    readonly fieldChanges: readonly {
      readonly fieldId: string;
      readonly currentState: ExposureEnginePreviewFieldDecision["state"] | "missing";
      readonly simulatedState: ExposureEnginePreviewFieldDecision["state"] | "missing";
    }[];
    readonly selectedFieldIdsAdded: readonly string[];
    readonly selectedFieldIdsRemoved: readonly string[];
  };
};

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function parseDraftIntent(payload: unknown): ExposureSimulationDraftIntent | undefined {
  if (payload === undefined || payload === null) {
    return undefined;
  }
  if (typeof payload !== "object") {
    throw new ExposureSimulationInvalidBodyError("draftIntent must be an object");
  }
  const record = payload as Record<string, unknown>;
  const mode = record.mode;
  if (mode !== "inherit_profile" && mode !== "override_fields" && mode !== "disabled") {
    throw new ExposureSimulationInvalidBodyError("draftIntent.mode is invalid");
  }
  const selectedFieldIds = Array.isArray(record.selectedFieldIds)
    ? record.selectedFieldIds.filter((entry): entry is string => typeof entry === "string")
    : [];
  const templateOverrideId =
    typeof record.templateOverrideId === "string" && record.templateOverrideId.trim().length > 0
      ? record.templateOverrideId.trim()
      : undefined;
  return {
    mode,
    selectedFieldIds,
    ...(templateOverrideId === undefined ? {} : { templateOverrideId }),
  };
}

export function parseExposureSimulationRequest(payload: unknown): ExposureSimulationRequest {
  if (typeof payload !== "object" || payload === null) {
    throw new ExposureSimulationInvalidBodyError("body must be an object");
  }
  const record = payload as Record<string, unknown>;
  const connectionId = readString(record, "connectionId");
  const eventType = readString(record, "eventType");
  if (connectionId.length === 0) {
    throw new ExposureSimulationInvalidBodyError("connectionId is required");
  }
  if (eventType.length === 0) {
    throw new ExposureSimulationInvalidBodyError("eventType is required");
  }
  return {
    connectionId,
    eventType,
    ...(record.draftIntent === undefined
      ? {}
      : { draftIntent: parseDraftIntent(record.draftIntent) }),
  };
}

async function resolveExposureProfile(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly effectiveContext: FieldExposureRuntimeCoordinate;
}): Promise<ExposureProfile | null> {
  const seededProfile = await resolveLegacyDeliveryExposureProfile({
    workspaceType: input.workspaceType,
    provider: input.effectiveContext.surface,
    eventType: input.effectiveContext.trigger,
  });
  if (seededProfile === null) {
    return null;
  }
  return resolvePersistedExposureProfileForContext({
    tenantId: input.tenantId,
    context: {
      workspaceType: input.workspaceType,
      entityType: seededProfile.entityType,
      surface: input.effectiveContext.surface,
      audience: input.effectiveContext.audience,
      trigger: input.effectiveContext.trigger,
    },
  });
}

function buildDraftExposureIntent(input: {
  readonly workspaceType: string;
  readonly connectionId: string;
  readonly eventType: string;
  readonly effectiveContext: FieldExposureRuntimeCoordinate;
  readonly draftIntent: ExposureSimulationDraftIntent;
}): ExposureIntent {
  return {
    workspaceType: input.workspaceType,
    entityType: "tour",
    surface: input.effectiveContext.surface,
    audience: input.effectiveContext.audience,
    trigger: input.effectiveContext.trigger,
    scope: buildConnectionExposureIntentScope({
      connectionId: input.connectionId,
      eventType: input.eventType,
    }),
    mode: input.draftIntent.mode,
    selectedFieldIds: input.draftIntent.selectedFieldIds,
    ...(input.draftIntent.templateOverrideId === undefined
      ? {}
      : { templateOverrideId: input.draftIntent.templateOverrideId }),
    source: NATIVE_EXPOSURE_INTENT_SOURCE,
    sourceId: "simulation-draft",
    version: "simulation-draft",
  };
}

export function buildSimulatedExposureIntent(input: {
  readonly workspaceType: string;
  readonly connectionId: string;
  readonly eventType: string;
  readonly effectiveContext: FieldExposureRuntimeCoordinate;
  readonly persistedIntent: ExposureIntent | null;
  readonly draftIntent: ExposureSimulationDraftIntent;
}): ExposureIntent {
  if (input.persistedIntent !== null) {
    return {
      ...input.persistedIntent,
      surface: input.effectiveContext.surface,
      audience: input.effectiveContext.audience,
      trigger: input.effectiveContext.trigger,
      scope: buildConnectionExposureIntentScope({
        connectionId: input.connectionId,
        eventType: input.eventType,
      }),
      mode: input.draftIntent.mode,
      selectedFieldIds: [...input.draftIntent.selectedFieldIds],
      ...(input.draftIntent.templateOverrideId === undefined
        ? {}
        : { templateOverrideId: input.draftIntent.templateOverrideId }),
    };
  }
  return buildDraftExposureIntent({
    workspaceType: input.workspaceType,
    connectionId: input.connectionId,
    eventType: input.eventType,
    effectiveContext: input.effectiveContext,
    draftIntent: input.draftIntent,
  });
}

async function resolveExposureSimulationRouteContext(
  auth: TenantAuthContext,
  input: {
    readonly connectionId: string;
    readonly eventType: string;
  },
): Promise<{
  readonly workspaceType: string;
  readonly effectiveContext: FieldExposureRuntimeCoordinate;
  readonly exposureIntent: ExposureIntent | null;
  readonly exposureProfile: ExposureProfile | null;
}> {
  const connection = await getIntegrationDetail(auth, input.connectionId);
  const workspaceType = connection.workspaceType;
  if (workspaceType === null || workspaceType.trim().length === 0) {
    throw new ExposureSimulationInvalidBodyError("connection has no workspace type");
  }
  const defaultContext = resolveIntegrationPolicyExposureCoordinate({
    provider: connection.provider,
    eventType: input.eventType,
  });
  const defaultSeededProfile = await resolveLegacyDeliveryExposureProfile({
    workspaceType,
    provider: defaultContext.surface,
    eventType: defaultContext.trigger,
  });
  const intentResolution = await resolveConnectionExposureIntentForRoute(
    createExposureIntentRepository(),
    {
      tenantId: auth.tenantId,
      connectionId: input.connectionId,
      eventType: input.eventType,
      defaultCoordinate: defaultContext,
      ...(defaultSeededProfile === null ? {} : { legacyProfileId: defaultSeededProfile.id }),
    },
  );
  const effectiveContext = intentResolution.effectiveContext;
  const exposureProfile = await resolveExposureProfile({
    tenantId: auth.tenantId,
    workspaceType,
    effectiveContext,
  });

  return {
    workspaceType,
    effectiveContext,
    exposureIntent: intentResolution.exposureIntent,
    exposureProfile,
  };
}

function selectedFieldIds(response: ExposureEnginePreviewResponse): readonly string[] {
  return Object.entries(response.fields)
    .filter(([, decision]) => decision.state === "visible")
    .map(([fieldId]) => fieldId)
    .sort((left, right) => left.localeCompare(right));
}

function difference(left: readonly string[], right: ReadonlySet<string>): readonly string[] {
  return left.filter((entry) => !right.has(entry));
}

export function diffExposureSimulationResponses(input: {
  readonly current: ExposureSimulationResponse;
  readonly simulated: ExposureSimulationResponse;
}): ExposureSimulationDiffResponse["diff"] {
  const fieldIds = new Set([
    ...Object.keys(input.current.fields),
    ...Object.keys(input.simulated.fields),
  ]);
  const fieldChanges = [...fieldIds]
    .sort((left, right) => left.localeCompare(right))
    .map((fieldId) => {
      const currentState = input.current.fields[fieldId]?.state ?? "missing";
      const simulatedState = input.simulated.fields[fieldId]?.state ?? "missing";
      return { fieldId, currentState, simulatedState };
    })
    .filter((change) => change.currentState !== change.simulatedState);
  const currentSelected = selectedFieldIds(input.current);
  const simulatedSelected = selectedFieldIds(input.simulated);
  const currentSet = new Set(currentSelected);
  const simulatedSet = new Set(simulatedSelected);

  return {
    changedFieldIds: fieldChanges.map((change) => change.fieldId),
    fieldChanges,
    selectedFieldIdsAdded: difference(simulatedSelected, currentSet),
    selectedFieldIdsRemoved: difference(currentSelected, simulatedSet),
  };
}

export async function simulateExposure(
  auth: TenantAuthContext,
  payload: unknown,
): Promise<ExposureSimulationResponse> {
  const request = parseExposureSimulationRequest(payload);
  const routeContext = await resolveExposureSimulationRouteContext(auth, request);
  const exposureIntent =
    request.draftIntent === undefined
      ? routeContext.exposureIntent
      : buildSimulatedExposureIntent({
          workspaceType: routeContext.workspaceType,
          connectionId: request.connectionId,
          eventType: request.eventType,
          effectiveContext: routeContext.effectiveContext,
          persistedIntent: routeContext.exposureIntent,
          draftIntent: request.draftIntent,
        });
  const preview = await buildDeterministicExposureEnginePreview({
    tenantId: auth.tenantId,
    workspaceType: routeContext.workspaceType,
    provider: routeContext.effectiveContext.surface,
    eventType: request.eventType,
    audience: routeContext.effectiveContext.audience,
    trigger: routeContext.effectiveContext.trigger,
    exposureIntent,
    exposureProfile: routeContext.exposureProfile,
  });

  return {
    ...preview,
    simulation: {
      connectionId: request.connectionId,
      eventType: request.eventType,
      effectiveContext: routeContext.effectiveContext,
      draftIntentApplied: request.draftIntent !== undefined,
    },
  };
}

export async function diffExposureSimulation(
  auth: TenantAuthContext,
  payload: unknown,
): Promise<ExposureSimulationDiffResponse> {
  const request = parseExposureSimulationRequest(payload);
  const current = await simulateExposure(auth, {
    connectionId: request.connectionId,
    eventType: request.eventType,
  });
  const simulated = await simulateExposure(auth, request);
  return {
    current,
    simulated,
    diff: diffExposureSimulationResponses({ current, simulated }),
  };
}

