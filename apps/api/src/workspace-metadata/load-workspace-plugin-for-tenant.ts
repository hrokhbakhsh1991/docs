import {
  assertWorkspaceDefinitionPayload,
  type WorkspaceDefinitionPayload,
} from "@app-tour/workspace-sdk/metadata";

import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin.ts";
import { isWorkspaceMetadataEnabled } from "./is-workspace-metadata-enabled.ts";
import { isWorkspaceMetadataEnabledForTenant, isWorkspaceMetadataTenantAllowlistConfigured } from "./is-workspace-metadata-enabled-for-tenant.ts";
import { adaptMetadataPayloadToWorkspacePlugin } from "./metadata-plugin-adapter.ts";
import {
  WorkspaceDefinitionRepository,
  type WorkspaceDefinitionVersionRow,
} from "./workspace-definition.repository.ts";

export type TenantWorkspaceMetadataBinding = {
  readonly definitionId: string;
  /** Pin version; omit or null for latest published. */
  readonly definitionVersion?: number | null;
};

export type ResolveWorkspacePluginForTenantInput = {
  readonly workspaceType: string;
  readonly tenantId?: string | null;
  readonly metadataBinding?: TenantWorkspaceMetadataBinding | null;
  readonly definitionRepository?: WorkspaceDefinitionRepository;
  readonly loadPublishedVersion?: (
    definitionId: string,
    version: number | null | undefined
  ) => Promise<WorkspaceDefinitionVersionRow | null>;
};

function parseDefinitionPayload(row: WorkspaceDefinitionVersionRow): WorkspaceDefinitionPayload {
  assertWorkspaceDefinitionPayload(row.payload);
  return row.payload;
}

/**
 * P3-A runtime resolution: metadata definition when flag + binding set; else package plugin.
 * Tenant DB columns (A5) populate `metadataBinding`; until then callers pass binding explicitly.
 */
export async function resolveWorkspacePluginForTenant(
  input: ResolveWorkspacePluginForTenantInput
): Promise<ReturnType<typeof resolveWorkspacePluginForType>> {
  const packagePlugin = resolveWorkspacePluginForType(input.workspaceType);

  if (!isWorkspaceMetadataEnabled() || !input.metadataBinding?.definitionId) {
    return packagePlugin;
  }

  if (isWorkspaceMetadataTenantAllowlistConfigured()) {
    if (!input.tenantId || !isWorkspaceMetadataEnabledForTenant(input.tenantId)) {
      return packagePlugin;
    }
  }

  const load =
    input.loadPublishedVersion ??
    ((definitionId, version) =>
      (input.definitionRepository ?? new WorkspaceDefinitionRepository()).getPublishedVersion(
        definitionId,
        version
      ));

  const row = await load(
    input.metadataBinding.definitionId,
    input.metadataBinding.definitionVersion ?? null
  );
  if (!row) {
    throw new Error(
      `WORKSPACE_DEFINITION_NOT_FOUND:${input.metadataBinding.definitionId}`
    );
  }

  return adaptMetadataPayloadToWorkspacePlugin(parseDefinitionPayload(row), packagePlugin);
}
