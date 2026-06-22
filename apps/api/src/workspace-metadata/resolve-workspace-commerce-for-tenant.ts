import {
  DEFAULT_WORKSPACE_COMMERCE_CONFIG,
  type WorkspaceCommerceConfig,
} from "@app-tour/workspace-sdk/metadata";

import type { PlatformTenantRepository } from "../platform/platform-tenant.repository.ts";
import { isWorkspaceMetadataEnabled } from "./is-workspace-metadata-enabled.ts";
import {
  isWorkspaceMetadataEnabledForTenant,
  isWorkspaceMetadataTenantAllowlistConfigured,
} from "./is-workspace-metadata-enabled-for-tenant.ts";
import {
  type ResolveWorkspacePluginForTenantInput,
  type TenantWorkspaceMetadataBinding,
} from "./load-workspace-plugin-for-tenant.ts";
import { mergeCommerceIntoWorkspaceDefinitionPayload } from "./persist-commerce-on-publish.ts";
import { readTenantWorkspaceMetadataBinding } from "./read-tenant-workspace-metadata-binding.ts";
import { WorkspaceDefinitionRepository } from "./workspace-definition.repository.ts";

export const DENALI_FROZEN_COMMERCE_CONFIG: WorkspaceCommerceConfig = Object.freeze({
  paymentMode: "offline_receipt",
  gatewayProvider: null,
  currency: "IRR",
});

function isDenaliWorkspaceType(workspaceType: string): boolean {
  return workspaceType.trim().toLowerCase() === "denali";
}

/**
 * P5-C-N-004 — resolve workspace commerce from metadata binding or package default.
 * Denali tenants always return offline_receipt (PC-07).
 */
export async function resolveWorkspaceCommerceConfigForTenant(
  input: ResolveWorkspacePluginForTenantInput
): Promise<WorkspaceCommerceConfig> {
  if (isDenaliWorkspaceType(input.workspaceType)) {
    return DENALI_FROZEN_COMMERCE_CONFIG;
  }

  if (!isWorkspaceMetadataEnabled() || !input.metadataBinding?.definitionId) {
    return DEFAULT_WORKSPACE_COMMERCE_CONFIG;
  }

  if (isWorkspaceMetadataTenantAllowlistConfigured()) {
    if (!input.tenantId || !isWorkspaceMetadataEnabledForTenant(input.tenantId)) {
      return DEFAULT_WORKSPACE_COMMERCE_CONFIG;
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
    return DEFAULT_WORKSPACE_COMMERCE_CONFIG;
  }

  const merged = mergeCommerceIntoWorkspaceDefinitionPayload(row.payload);
  const commerce = (merged as { commerce?: WorkspaceCommerceConfig }).commerce;
  return commerce ?? DEFAULT_WORKSPACE_COMMERCE_CONFIG;
}

export async function resolveWorkspaceCommerceConfigForTenantById(
  tenantId: string,
  deps: {
    tenantRepository?: PlatformTenantRepository;
    loadPublishedVersion?: ResolveWorkspacePluginForTenantInput["loadPublishedVersion"];
  } = {}
): Promise<WorkspaceCommerceConfig> {
  const binding = await readTenantWorkspaceMetadataBinding(tenantId, deps);
  if (!binding) {
    throw new Error(`TENANT_NOT_FOUND:${tenantId}`);
  }
  return resolveWorkspaceCommerceConfigForTenant({
    workspaceType: binding.workspaceType,
    tenantId,
    metadataBinding: binding.metadataBinding,
    loadPublishedVersion: deps.loadPublishedVersion,
  });
}

export type ResolveWorkspaceCommerceFromBindingInput = {
  readonly workspaceType: string;
  readonly metadataBinding: TenantWorkspaceMetadataBinding | null;
  readonly payloadCommerce?: WorkspaceCommerceConfig | null;
};

/** Pure helper — map bound definition commerce onto tenant context (unit tests). */
export function resolveWorkspaceCommerceFromBinding(
  input: ResolveWorkspaceCommerceFromBindingInput
): WorkspaceCommerceConfig {
  if (isDenaliWorkspaceType(input.workspaceType)) {
    return DENALI_FROZEN_COMMERCE_CONFIG;
  }
  if (!input.metadataBinding?.definitionId) {
    return DEFAULT_WORKSPACE_COMMERCE_CONFIG;
  }
  return input.payloadCommerce ?? DEFAULT_WORKSPACE_COMMERCE_CONFIG;
}
