import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import type { ExposureDecision } from "@app-tour/platform-core";

import { isFieldExposureDecisionEngineShadowEnabled } from "../integrations/application/dispatch-integration-domain-event";
import {
  listWorkspaceIntegrations,
  type IntegrationConnectionPublicDto,
} from "../integrations/http/integrations.service";
import { resolveIntegrationPolicyExposureCoordinate } from "../integrations/application/integration-policy-engine";
import { buildWorkspaceIntegrationSurfaceMeta } from "../integrations/platform/integration-surface-meta";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";

import { buildFieldExposureEngineDecisionMap } from "./build-field-exposure-engine-input";
import {
  buildConnectionExposureIntentScope,
  resolveConnectionIntentForEventSync,
} from "./connection-exposure-intent-scope";
import type { ExposureIntent } from "./exposure-intent";
import {
  resolveLegacyDeliveryExposureProfile,
} from "./legacy-delivery-exposure-mapper";
import type { ExposureProfile } from "./exposure-profile";
import { createExposureIntentRepository } from "./prisma-exposure-intent.repository";
import { createExposureProfileRepository } from "./prisma-exposure-profile.repository";
import { resolveRegistrySeededExposureProfile } from "./resolve-registry-seeded-exposure-profile";
import type { ExposureIntentContextKey } from "./exposure-intent.repository";
import { resolveEngineSelectedFieldIds } from "./resolve-exposure-decision";
import {
  resolveFieldExposureRuntimeMode,
  type FieldExposureRuntimeMode,
} from "./exposure-runtime-mode";
import { isFieldExposureShadowDiagnosticsEnabled } from "./field-exposure-shadow-diagnostics";
import { ExposureWorkspaceForbiddenError } from "./exposure-catalog.service";

import { resolveDeterministicExposurePreviewPayload } from "./deterministic-exposure-preview-payload";

export type ExposureControlPlaneFieldDecision = {
  readonly fieldId: string;
  readonly state: ExposureDecision["state"];
  readonly reasonChain: readonly string[];
  readonly appliedPolicies: readonly string[];
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
  readonly seededProfile: ExposureProfile | null;
  readonly persistedProfile: ExposureProfile | null;
  readonly activeExposureIntent: ExposureIntent | null;
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
  readonly backingSource: IntegrationConnectionPublicDto["backingSource"];
  readonly contexts: readonly ExposureControlPlaneEventContext[];
};

export type WorkspaceExposureControlPlaneResponse = {
  readonly workspaceType: string;
  readonly runtime: {
    readonly fieldExposureRuntimeMode: FieldExposureRuntimeMode;
    readonly forwardEngineShadowEnabled: boolean;
    readonly activeDeliverySelector: "engine_selected_field_ids";
    readonly parityInstrumentation: "forward_engine_shadow" | "legacy_mirror_shadow" | "none";
  };
  readonly connections: readonly ExposureControlPlaneConnection[];
};

export function resolveExposureControlPlaneParityInstrumentation(input: {
  readonly forwardEngineShadowEnabled: boolean;
  readonly legacyShadowDiagnosticsEnabled: boolean;
}): WorkspaceExposureControlPlaneResponse["runtime"]["parityInstrumentation"] {
  if (input.forwardEngineShadowEnabled) {
    return "forward_engine_shadow";
  }
  return input.legacyShadowDiagnosticsEnabled ? "legacy_mirror_shadow" : "none";
}

async function resolveWorkspaceTypeForRoute(
  auth: TenantAuthContext,
  workspaceId: string,
): Promise<string> {
  if (auth.workspaceId !== undefined && auth.workspaceId === workspaceId) {
    return workspaceId;
  }
  const tenantWorkspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
  if (workspaceId.trim().toLowerCase() === tenantWorkspaceType.trim().toLowerCase()) {
    return tenantWorkspaceType;
  }
  throw new ExposureWorkspaceForbiddenError();
}

function buildEventTypeList(
  connection: IntegrationConnectionPublicDto,
  defaultEventTypes: readonly string[],
): readonly string[] {
  const seen = new Set<string>();
  for (const eventType of defaultEventTypes) {
    if (eventType.length > 0) {
      seen.add(eventType);
    }
  }
  for (const policy of connection.eventPolicies) {
    if (policy.eventType.length > 0) {
      seen.add(policy.eventType);
    }
  }
  for (const intent of connection.exposureIntents) {
    if (intent.eventType.length > 0) {
      seen.add(intent.eventType);
    }
  }
  return [...seen].sort((left, right) => left.localeCompare(right));
}

function resolveSamplePayload(eventType: string): Readonly<Record<string, unknown>> {
  return resolveDeterministicExposurePreviewPayload(eventType);
}

function contextsDiffer(
  stored: NonNullable<ExposureControlPlaneEventContext["storedContext"]> | null,
  effective: ExposureControlPlaneEventContext["effectiveContext"],
): boolean {
  if (stored === null) {
    return false;
  }
  return (
    stored.surface !== effective.surface ||
    stored.audience !== effective.audience ||
    stored.trigger !== effective.trigger
  );
}

async function buildEnginePreview(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly eventType: string;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly exposureIntent: ExposureIntent | null;
  readonly exposureProfile: ExposureProfile | null;
}): Promise<ExposureControlPlaneEventContext["enginePreview"]> {
  try {
    const decisionMap = await buildFieldExposureEngineDecisionMap({
      tenantId: input.tenantId,
      workspaceType: input.workspaceType,
      eventType: input.eventType,
      surface: input.surface,
      audience: input.audience,
      trigger: input.trigger,
      payload: input.payload,
      exposureIntent: input.exposureIntent,
      exposureProfile: input.exposureProfile,
    });
    const candidateFieldIds = [...decisionMap.keys()].sort((left, right) =>
      left.localeCompare(right),
    );
    const engineSelectedFieldIds = resolveEngineSelectedFieldIds({
      candidateFieldIds,
      decisions: decisionMap,
    });
    const decisions = candidateFieldIds.map((fieldId) => {
      const decision = decisionMap.get(fieldId);
      if (decision === undefined) {
        return {
          fieldId,
          state: "hidden" as const,
          reasonChain: ["field_exposure_engine:missing_decision"],
          appliedPolicies: [],
        };
      }
      return {
        fieldId,
        state: decision.state,
        reasonChain: decision.reasonChain,
        appliedPolicies: decision.appliedPolicies,
      };
    });
    return {
      samplePayload: input.payload,
      decisions,
      engineSelectedFieldIds,
    };
  } catch {
    return null;
  }
}

async function collectLegacyIntentContextKeys(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly connections: readonly IntegrationConnectionPublicDto[];
  readonly defaultEventTypes: readonly string[];
  readonly intentsByConnection: ReadonlyMap<string, readonly ExposureIntent[]>;
}): Promise<ExposureIntentContextKey[]> {
  const keys: ExposureIntentContextKey[] = [];
  const seen = new Set<string>();

  for (const connection of input.connections) {
    const eventTypes = buildEventTypeList(connection, input.defaultEventTypes);
    const connectionIntents = input.intentsByConnection.get(connection.id) ?? [];

    for (const eventType of eventTypes) {
      const defaultContext = resolveIntegrationPolicyExposureCoordinate({
        provider: connection.provider,
        eventType,
      });
      if (
        connectionIntents.some((intent) => intent.scope.eventType === eventType)
      ) {
        continue;
      }

      const defaultSeededProfile = await resolveLegacyDeliveryExposureProfile({
        workspaceType: input.workspaceType,
        provider: defaultContext.surface,
        eventType: defaultContext.trigger,
      });
      if (defaultSeededProfile === null) {
        continue;
      }

      const contextKey: ExposureIntentContextKey = {
        tenantId: input.tenantId,
        profileId: defaultSeededProfile.id,
        surface: defaultContext.surface,
        audience: defaultContext.audience,
        trigger: defaultContext.trigger,
        scope: buildConnectionExposureIntentScope({
          connectionId: connection.id,
          eventType,
        }),
      };
      const dedupeKey = `${contextKey.profileId}|${contextKey.surface}|${contextKey.audience}|${contextKey.trigger}|${connection.id}|${eventType}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      keys.push(contextKey);
    }
  }

  return keys;
}

async function collectProfileSeedsForConnections(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly connections: readonly IntegrationConnectionPublicDto[];
  readonly defaultEventTypes: readonly string[];
  readonly intentsByConnection: ReadonlyMap<string, readonly ExposureIntent[]>;
  readonly legacyIntentLookup: ReadonlyMap<string, ExposureIntent>;
}): Promise<ExposureProfile[]> {
  const seeds: ExposureProfile[] = [];
  const seen = new Set<string>();

  for (const connection of input.connections) {
    const eventTypes = buildEventTypeList(connection, input.defaultEventTypes);
    const connectionIntents = input.intentsByConnection.get(connection.id) ?? [];

    for (const eventType of eventTypes) {
      const defaultContext = resolveIntegrationPolicyExposureCoordinate({
        provider: connection.provider,
        eventType,
      });
      const defaultSeededProfile = await resolveLegacyDeliveryExposureProfile({
        workspaceType: input.workspaceType,
        provider: defaultContext.surface,
        eventType: defaultContext.trigger,
      });
      const intentResolution = resolveConnectionIntentForEventSync({
        tenantId: input.tenantId,
        connectionId: connection.id,
        eventType,
        defaultCoordinate: defaultContext,
        ...(defaultSeededProfile === null
          ? {}
          : { legacyProfileId: defaultSeededProfile.id }),
        connectionIntents,
        legacyIntentLookup: input.legacyIntentLookup,
      });
      const effectiveContext = intentResolution.effectiveContext;
      const seededProfile = await resolveLegacyDeliveryExposureProfile({
        workspaceType: input.workspaceType,
        provider: effectiveContext.surface,
        eventType: effectiveContext.trigger,
      });
      if (seededProfile === null || seen.has(seededProfile.id)) {
        continue;
      }

      const registrySeed = await resolveRegistrySeededExposureProfile({
        workspaceType: input.workspaceType,
        entityType: seededProfile.entityType,
        surface: effectiveContext.surface,
        audience: effectiveContext.audience,
        trigger: effectiveContext.trigger,
      });
      if (registrySeed === null) {
        continue;
      }
      seen.add(registrySeed.id);
      seeds.push(registrySeed);
    }
  }

  return seeds;
}

async function buildConnectionContextsFromPrefetch(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly connection: IntegrationConnectionPublicDto;
  readonly defaultEventTypes: readonly string[];
  readonly connectionIntents: readonly ExposureIntent[];
  readonly legacyIntentLookup: ReadonlyMap<string, ExposureIntent>;
  readonly profileById: ReadonlyMap<string, ExposureProfile>;
}): Promise<readonly ExposureControlPlaneEventContext[]> {
  const eventTypes = buildEventTypeList(input.connection, input.defaultEventTypes);
  const contexts: ExposureControlPlaneEventContext[] = [];

  for (const eventType of eventTypes) {
    const defaultContext = resolveIntegrationPolicyExposureCoordinate({
      provider: input.connection.provider,
      eventType,
    });
    const defaultSeededProfile = await resolveLegacyDeliveryExposureProfile({
      workspaceType: input.workspaceType,
      provider: defaultContext.surface,
      eventType: defaultContext.trigger,
    });
    const intentResolution = resolveConnectionIntentForEventSync({
      tenantId: input.tenantId,
      connectionId: input.connection.id,
      eventType,
      defaultCoordinate: defaultContext,
      ...(defaultSeededProfile === null
        ? {}
        : { legacyProfileId: defaultSeededProfile.id }),
      connectionIntents: input.connectionIntents,
      legacyIntentLookup: input.legacyIntentLookup,
    });
    const effectiveContext = intentResolution.effectiveContext;
    const seededProfile = await resolveLegacyDeliveryExposureProfile({
      workspaceType: input.workspaceType,
      provider: effectiveContext.surface,
      eventType: effectiveContext.trigger,
    });
    const persistedProfile =
      seededProfile === null ? null : (input.profileById.get(seededProfile.id) ?? null);
    const activeExposureIntent = intentResolution.exposureIntent;
    const eventPolicy = input.connection.eventPolicies.find(
      (policy: { readonly eventType: string; readonly enabled: boolean }) =>
        policy.eventType === eventType,
    );
    const samplePayload = resolveSamplePayload(eventType);
    const storedContext =
      activeExposureIntent === null
        ? null
        : {
            surface: activeExposureIntent.surface ?? effectiveContext.surface,
            audience: activeExposureIntent.audience ?? effectiveContext.audience,
            trigger: activeExposureIntent.trigger ?? effectiveContext.trigger,
          };

    contexts.push({
      eventType,
      eventPolicyEnabled: eventPolicy?.enabled ?? false,
      storedContext,
      effectiveContext,
      storedDiffersFromEffective: contextsDiffer(storedContext, effectiveContext),
      coordinateControlsRuntimeEffective: intentResolution.coordinateControlsRuntimeEffective,
      seededProfile,
      persistedProfile,
      activeExposureIntent,
      enginePreview:
        input.connection.backingSource === "integration_connection"
          ? await buildEnginePreview({
              tenantId: input.tenantId,
              workspaceType: input.workspaceType,
              eventType,
              surface: effectiveContext.surface,
              audience: effectiveContext.audience,
              trigger: effectiveContext.trigger,
              payload: samplePayload,
              exposureIntent: activeExposureIntent,
              exposureProfile: persistedProfile,
            })
          : null,
    });
  }

  return contexts;
}

export async function getWorkspaceExposureControlPlane(
  auth: TenantAuthContext,
  workspaceId: string,
): Promise<WorkspaceExposureControlPlaneResponse> {
  const workspaceType = await resolveWorkspaceTypeForRoute(auth, workspaceId);
  const integrations = await listWorkspaceIntegrations(auth, workspaceId);
  const meta = await buildWorkspaceIntegrationSurfaceMeta(workspaceType);
  const defaultEventTypes =
    meta.providers.flatMap((provider) =>
      provider.defaultEventPolicies.map((policy) => policy.eventType),
    ) ?? [];
  const runtimeMode = resolveFieldExposureRuntimeMode();
  const forwardEngineShadowEnabled = isFieldExposureDecisionEngineShadowEnabled();
  const legacyShadowDiagnosticsEnabled = isFieldExposureShadowDiagnosticsEnabled();

  const intentRepository = createExposureIntentRepository();
  const profileRepository = createExposureProfileRepository();

  const enabledConnections = integrations.items.filter((connection) => connection.enabled);
  const intentsByConnection = await intentRepository.listForConnectionScopes({
    tenantId: auth.tenantId,
    connectionIds: enabledConnections.map((connection) => connection.id),
  });

  const legacyIntentKeys = await collectLegacyIntentContextKeys({
    tenantId: auth.tenantId,
    workspaceType,
    connections: enabledConnections,
    defaultEventTypes,
    intentsByConnection,
  });
  const legacyIntentLookup = await intentRepository.findForContexts(legacyIntentKeys);

  const profileSeeds = await collectProfileSeedsForConnections({
    tenantId: auth.tenantId,
    workspaceType,
    connections: enabledConnections,
    defaultEventTypes,
    intentsByConnection,
    legacyIntentLookup,
  });
  const profileById = await profileRepository.ensureSeededProfiles({
    tenantId: auth.tenantId,
    seeds: profileSeeds,
  });

  const connections = await Promise.all(
    enabledConnections.map(async (connection) => ({
      connectionId: connection.id,
      provider: connection.provider,
      enabled: connection.enabled,
      backingSource: connection.backingSource,
      contexts: await buildConnectionContextsFromPrefetch({
        tenantId: auth.tenantId,
        workspaceType,
        connection,
        defaultEventTypes,
        connectionIntents: intentsByConnection.get(connection.id) ?? [],
        legacyIntentLookup,
        profileById,
      }),
    })),
  );

  return {
    workspaceType,
    runtime: {
      fieldExposureRuntimeMode: runtimeMode,
      forwardEngineShadowEnabled,
      activeDeliverySelector: "engine_selected_field_ids",
      parityInstrumentation: resolveExposureControlPlaneParityInstrumentation({
        forwardEngineShadowEnabled,
        legacyShadowDiagnosticsEnabled,
      }),
    },
    connections,
  };
}
