import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import {
  resolveFieldExposureDecision,
  type ExposureDecision,
} from "@app-tour/platform-core";

import { resolveIntegrationPolicyExposureCoordinate } from "../integrations/application/integration-policy-engine";
import { getIntegrationDetail, IntegrationNotFoundError } from "../integrations/http/integrations.service";
import {
  buildFieldExposureEngineDecisionInput,
  buildFieldExposureEngineInputSnapshot,
} from "./build-field-exposure-engine-input";
import { resolveConnectionExposureIntentForRoute } from "./connection-exposure-intent-scope";
import { buildExposureFieldCatalog } from "./exposure-field-catalog";
import type { ExposureIntent } from "./exposure-intent";
import {
  LEGACY_DELIVERY_EXTERNAL_CHANNEL_AUDIENCE,
  resolveLegacyDeliveryExposureProfile,
} from "./legacy-delivery-exposure-mapper";
import type { ExposureProfile } from "./exposure-profile";
import type { FieldExposureRuntimeCoordinate } from "./resolve-runtime-truth-source";
import { resolvePersistedExposureProfileForContext } from "./resolve-persisted-exposure-profile";
import { createExposureIntentRepository } from "./create-exposure-intent-repository";
import { resolveDeterministicExposurePreviewPayload } from "./deterministic-exposure-preview-payload";

export class ExposureEnginePreviewInvalidQueryError extends Error {
  readonly code = "EXPOSURE_ENGINE_PREVIEW_INVALID_QUERY";
  constructor(message: string) {
    super(message);
    this.name = "ExposureEnginePreviewInvalidQueryError";
  }
}

export class ExposureEnginePreviewUnavailableError extends Error {
  readonly code = "EXPOSURE_ENGINE_PREVIEW_UNAVAILABLE";
  constructor(message: string) {
    super(message);
    this.name = "ExposureEnginePreviewUnavailableError";
  }
}

export type ExposureEnginePreviewFieldDecision = {
  readonly state: ExposureDecision["state"];
  readonly reasonChain: readonly string[];
  readonly appliedPolicies: readonly string[];
};

export type ExposureEnginePreviewResponse = {
  readonly samplePayload: Readonly<Record<string, unknown>>;
  readonly fields: Readonly<Record<string, ExposureEnginePreviewFieldDecision>>;
  readonly summary: {
    readonly visibleCount: number;
    readonly hiddenCount: number;
    readonly blockedCount: number;
  };
};

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

function summarizeDecisions(
  fields: Readonly<Record<string, ExposureEnginePreviewFieldDecision>>,
): ExposureEnginePreviewResponse["summary"] {
  let visibleCount = 0;
  let hiddenCount = 0;
  let blockedCount = 0;

  for (const decision of Object.values(fields)) {
    if (decision.state === "visible") {
      visibleCount += 1;
    } else if (decision.state === "hidden") {
      hiddenCount += 1;
    } else if (decision.state === "blocked") {
      blockedCount += 1;
    }
  }

  return { visibleCount, hiddenCount, blockedCount };
}

export async function buildDeterministicExposureEnginePreview(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly provider: string;
  readonly eventType: string;
  readonly audience?: string;
  readonly trigger?: string;
  readonly exposureIntent: ExposureIntent | null;
  readonly exposureProfile: ExposureProfile | null;
}): Promise<ExposureEnginePreviewResponse> {
  const catalog = await buildExposureFieldCatalog(input.workspaceType);
  const payload = resolveDeterministicExposurePreviewPayload(input.eventType);
  if (catalog.length === 0) {
    return {
      samplePayload: payload,
      fields: {},
      summary: { visibleCount: 0, hiddenCount: 0, blockedCount: 0 },
    };
  }

  const snapshot = await buildFieldExposureEngineInputSnapshot({
    workspaceType: input.workspaceType,
    eventType: input.eventType,
    ...(input.trigger === undefined ? {} : { trigger: input.trigger }),
    payload,
  });
  const fields: Record<string, ExposureEnginePreviewFieldDecision> = {};
  const sortedFieldIds = catalog.map((field) => field.id).sort((left, right) => left.localeCompare(right));

  for (const fieldId of sortedFieldIds) {
    const decision = resolveFieldExposureDecision(
      buildFieldExposureEngineDecisionInput({
        tenantId: input.tenantId,
        workspaceType: input.workspaceType,
        surface: input.provider,
        audience: input.audience ?? LEGACY_DELIVERY_EXTERNAL_CHANNEL_AUDIENCE,
        fieldId,
        snapshot,
        exposureIntent: input.exposureIntent,
        exposureProfile: input.exposureProfile,
      }),
    );

    fields[fieldId] = {
      state: decision.state,
      reasonChain: decision.reasonChain,
      appliedPolicies: decision.appliedPolicies,
    };
  }

  return {
    samplePayload: payload,
    fields,
    summary: summarizeDecisions(fields),
  };
}

export async function getExposureEnginePreview(
  auth: TenantAuthContext,
  query: {
    readonly connectionId: string | null | undefined;
    readonly eventType: string | null | undefined;
  },
): Promise<ExposureEnginePreviewResponse> {
  const connectionId = query.connectionId?.trim() ?? "";
  const eventType = query.eventType?.trim() ?? "";
  if (connectionId === "") {
    throw new ExposureEnginePreviewInvalidQueryError("connectionId is required");
  }
  if (eventType === "") {
    throw new ExposureEnginePreviewInvalidQueryError("eventType is required");
  }

  let connection;
  try {
    connection = await getIntegrationDetail(auth, connectionId);
  } catch (error) {
    if (error instanceof IntegrationNotFoundError) {
      throw error;
    }
    throw error;
  }

  const workspaceType = connection.workspaceType;
  if (workspaceType === null || workspaceType.trim().length === 0) {
    throw new ExposureEnginePreviewUnavailableError("connection has no workspace type");
  }
  const defaultContext = resolveIntegrationPolicyExposureCoordinate({
    provider: connection.provider,
    eventType,
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
      connectionId,
      eventType,
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

  return await buildDeterministicExposureEnginePreview({
    tenantId: auth.tenantId,
    workspaceType,
    provider: effectiveContext.surface,
    eventType,
    audience: effectiveContext.audience,
    trigger: effectiveContext.trigger,
    exposureIntent: intentResolution.exposureIntent,
    exposureProfile,
  });
}
