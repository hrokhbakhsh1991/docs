import { deriveMetadataCutoverStage } from "../workspace-metadata/derive-metadata-cutover-stage.ts";
import type { MetadataCutoverStage } from "../workspace-metadata/derive-metadata-cutover-stage.ts";

export type PlatformTenantWorkspaceDefinitionDto = {
  readonly definitionId: string;
  readonly definitionVersion: number | null;
  readonly displayName: string | null;
  readonly metadataCutoverStage: MetadataCutoverStage;
};

export function toPlatformTenantWorkspaceDefinitionDto(input: {
  definitionId: string | null;
  definitionVersion: number | null;
  displayName?: string | null;
  tenantId?: string;
}): PlatformTenantWorkspaceDefinitionDto | null {
  if (!input.definitionId) {
    return null;
  }
  const tenantId = input.tenantId ?? "";
  return {
    definitionId: input.definitionId,
    definitionVersion: input.definitionVersion,
    displayName: input.displayName ?? null,
    metadataCutoverStage: deriveMetadataCutoverStage({
      tenantId,
      workspaceDefinitionId: input.definitionId,
    }),
  };
}
