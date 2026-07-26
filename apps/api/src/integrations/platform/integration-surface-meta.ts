import {
  buildExposureSelectableFieldCatalog,
  type ExposureFieldCatalogEntry,
} from "../../exposure/exposure-field-catalog";
import { resolveIntegrationSurfaceForWorkspaceType } from "./resolve-integration-surface";

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

/** Registry-backed exposure field catalog entry exposed to integration UI/API. */
export type ExposureCandidateFieldMeta = ExposureFieldCatalogEntry;

export type WorkspaceIntegrationSurfaceMetaResponse = {
  readonly workspaceType: string | null;
  readonly providers: readonly IntegrationProviderSurfaceMeta[];
  /** Exposure-owned catalog for field selection; seeded from the registry deliverable seed. */
  readonly exposureCandidateFields: readonly ExposureCandidateFieldMeta[];
};

export async function buildWorkspaceIntegrationSurfaceMeta(
  workspaceType: string | null
): Promise<WorkspaceIntegrationSurfaceMetaResponse> {
  const surface = await resolveIntegrationSurfaceForWorkspaceType(workspaceType);
  if (surface === null) {
    return {
      workspaceType,
      providers: [],
      exposureCandidateFields: [],
    };
  }
  const exposureCandidateFields = await buildExposureSelectableFieldCatalog(workspaceType);

  return {
    workspaceType,
    exposureCandidateFields,
    providers: surface.providers.map((provider) => ({
      id: provider.id,
      configFields: provider.configFields.map((field) => ({
        id: field.id,
        kind: field.kind,
        requiredOnCreate: field.requiredOnCreate,
      })),
      credentialFields: provider.credentialFields.map((field) => ({
        id: field.id,
        kind: field.kind,
        requiredOnCreate: field.requiredOnCreate,
      })),
      defaultCapabilities: provider.defaultCapabilities,
      defaultEventPolicies: provider.defaultEventPolicies.map((policy) => ({
        eventType: policy.eventType,
        enabled: policy.enabled,
      })),
    })),
  };
}
