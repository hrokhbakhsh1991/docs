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
import { resolveConnectionExposureIntentForRoute } from "./connection-exposure-intent-scope";
import type { ExposureIntent } from "./exposure-intent";
import { createExposureIntentRepository } from "./prisma-exposure-intent.repository";
import {
  resolveLegacyDeliveryExposureProfile,
} from "./legacy-delivery-exposure-mapper";
import type { ExposureProfile } from "./exposure-profile";
import { resolvePersistedExposureProfileForContext } from "./resolve-persisted-exposure-profile";
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

function buildEnginePreview(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly eventType: string;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly exposureIntent: ExposureIntent | null;
  readonly exposureProfile: ExposureProfile | null;
}): ExposureControlPlaneEventContext["enginePreview"] {
  try {
    const decisionMap = buildFieldExposureEngineDecisionMap({
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

async function buildConnectionContexts(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly connection: IntegrationConnectionPublicDto;
  readonly defaultEventTypes: readonly string[];
}): Promise<readonly ExposureControlPlaneEventContext[]> {
  const eventTypes = buildEventTypeList(input.connection, input.defaultEventTypes);
  const contexts: ExposureControlPlaneEventContext[] = [];

  for (const eventType of eventTypes) {
    const defaultContext = resolveIntegrationPolicyExposureCoordinate({
      provider: input.connection.provider,
      eventType,
    });
    const defaultSeededProfile = resolveLegacyDeliveryExposureProfile({
      workspaceType: input.workspaceType,
      provider: defaultContext.surface,
      eventType: defaultContext.trigger,
    });
    const intentResolution = await resolveConnectionExposureIntentForRoute(
      createExposureIntentRepository(),
      {
        tenantId: input.tenantId,
        connectionId: input.connection.id,
        eventType,
        defaultCoordinate: defaultContext,
        ...(defaultSeededProfile === null ? {} : { legacyProfileId: defaultSeededProfile.id }),
      },
    );
    const effectiveContext = intentResolution.effectiveContext;
    const seededProfile = resolveLegacyDeliveryExposureProfile({
      workspaceType: input.workspaceType,
      provider: effectiveContext.surface,
      eventType: effectiveContext.trigger,
    });
    const persistedProfile =
      seededProfile === null
        ? null
        : await resolvePersistedExposureProfileForContext({
            tenantId: input.tenantId,
            context: {
              workspaceType: input.workspaceType,
              entityType: seededProfile.entityType,
              surface: effectiveContext.surface,
              audience: effectiveContext.audience,
              trigger: effectiveContext.trigger,
            },
          });
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
          ? buildEnginePreview({
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
  const meta = buildWorkspaceIntegrationSurfaceMeta(workspaceType);
  const defaultEventTypes =
    meta.providers.flatMap((provider) =>
      provider.defaultEventPolicies.map((policy) => policy.eventType),
    ) ?? [];
  const runtimeMode = resolveFieldExposureRuntimeMode();
  const forwardEngineShadowEnabled = isFieldExposureDecisionEngineShadowEnabled();
  const legacyShadowDiagnosticsEnabled = isFieldExposureShadowDiagnosticsEnabled();

  const connections = await Promise.all(
    integrations.items
      .filter((connection) => connection.enabled)
      .map(async (connection) => ({
        connectionId: connection.id,
        provider: connection.provider,
        enabled: connection.enabled,
        backingSource: connection.backingSource,
        contexts: await buildConnectionContexts({
          tenantId: auth.tenantId,
          workspaceType,
          connection,
          defaultEventTypes,
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
