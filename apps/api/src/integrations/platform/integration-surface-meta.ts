import { resolveIntegrationSurfaceForWorkspaceType } from "./resolve-integration-surface";

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

export function buildWorkspaceIntegrationSurfaceMeta(
  workspaceType: string | null
): WorkspaceIntegrationSurfaceMetaResponse {
  const surface = resolveIntegrationSurfaceForWorkspaceType(workspaceType);
  if (surface === null) {
    return { workspaceType, providers: [] };
  }

  return {
    workspaceType,
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
    })),
  };
}
