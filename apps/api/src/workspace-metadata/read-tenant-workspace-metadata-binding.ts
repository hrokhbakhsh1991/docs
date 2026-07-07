import { PlatformTenantRepository } from "../platform/platform-tenant.repository.ts";
import { findTenantById, isStaticTenantRegistryAllowed } from "../tenant/tenant-registry.ts";
import {
  resolveWorkspacePluginForTenant,
  type ResolveWorkspacePluginForTenantInput,
  type TenantWorkspaceMetadataBinding,
} from "./load-workspace-plugin-for-tenant.ts";

export type ResolveWorkspacePluginForTenantByIdDeps = {
  tenantRepository?: PlatformTenantRepository;
  loadPublishedVersion?: ResolveWorkspacePluginForTenantInput["loadPublishedVersion"];
};

export function toTenantWorkspaceMetadataBinding(input: {
  workspaceDefinitionId: string | null;
  workspaceDefinitionVersion: number | null;
}): TenantWorkspaceMetadataBinding | null {
  if (!input.workspaceDefinitionId) {
    return null;
  }
  return {
    definitionId: input.workspaceDefinitionId,
    definitionVersion: input.workspaceDefinitionVersion,
  };
}

export async function resolveWorkspacePluginForTenantById(
  tenantId: string,
  deps: ResolveWorkspacePluginForTenantByIdDeps = {}
): Promise<Awaited<ReturnType<typeof resolveWorkspacePluginForTenant>>> {
  const tenant = await (deps.tenantRepository ?? new PlatformTenantRepository()).getById(tenantId);
  if (!tenant) {
    throw new Error(`TENANT_NOT_FOUND:${tenantId}`);
  }
  return resolveWorkspacePluginForTenant({
    workspaceType: tenant.workspaceType,
    tenantId: tenant.id,
    metadataBinding: toTenantWorkspaceMetadataBinding(tenant),
    loadPublishedVersion: deps.loadPublishedVersion,
  });
}

export async function readTenantWorkspaceMetadataBinding(
  tenantId: string,
  deps: {
    tenantRepository?: PlatformTenantRepository;
  } = {}
): Promise<{
  workspaceType: string;
  metadataBinding: TenantWorkspaceMetadataBinding | null;
} | null> {
  let tenant: Awaited<ReturnType<PlatformTenantRepository["getById"]>> = null;
  try {
    tenant = await (deps.tenantRepository ?? new PlatformTenantRepository()).getById(tenantId);
  } catch {
    tenant = null;
  }
  if (tenant) {
    return {
      workspaceType: tenant.workspaceType,
      metadataBinding: toTenantWorkspaceMetadataBinding(tenant),
    };
  }

  if (!isStaticTenantRegistryAllowed()) {
    return null;
  }

  const registered = findTenantById(tenantId);
  if (!registered) {
    return null;
  }

  return {
    workspaceType: registered.workspaceType,
    metadataBinding: null,
  };
}
