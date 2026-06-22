import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import type { WorkspaceDefinitionPayload } from "@app-tour/workspace-sdk/metadata";

import { adaptMetadataPayloadToWorkspacePlugin } from "./adapt-metadata-payload-to-workspace-plugin";
import { isOperatorWorkspaceMetadataEnabled } from "./is-operator-workspace-metadata-enabled";
import {
  isOperatorWorkspaceMetadataEnabledForTenant,
  isOperatorWorkspaceMetadataTenantAllowlistConfigured,
} from "./is-operator-workspace-metadata-enabled-for-tenant";
import { loadWorkspacePluginById } from "./load-workspace-plugin";

export type OperatorWorkspaceMetadataBinding = {
  readonly definitionId: string;
  /** Pin version; omit or null for latest published. */
  readonly definitionVersion?: number | null;
};

export type ResolveOperatorWorkspacePluginDeps = {
  readonly metadataEnabled?: boolean;
  readonly tenantAllowlist?: string | null;
  readonly loadPackagePlugin?: (pluginId: string) => Promise<WorkspacePlugin>;
  readonly loadMetadataPayload?: (
    binding: OperatorWorkspaceMetadataBinding
  ) => Promise<WorkspaceDefinitionPayload | null>;
  readonly adaptMetadata?: (
    payload: WorkspaceDefinitionPayload,
    overlay: WorkspacePlugin
  ) => WorkspacePlugin;
};

export type ResolveOperatorWorkspacePluginInput = {
  readonly pluginId: string;
  readonly tenantId?: string | null;
  readonly metadataBinding?: OperatorWorkspaceMetadataBinding | null;
} & ResolveOperatorWorkspacePluginDeps;

function resolveMetadataEnabled(deps: ResolveOperatorWorkspacePluginDeps): boolean {
  if (deps.metadataEnabled !== undefined) {
    return deps.metadataEnabled;
  }
  return isOperatorWorkspaceMetadataEnabled();
}

function shouldUseOperatorMetadataPath(input: ResolveOperatorWorkspacePluginInput): boolean {
  if (!resolveMetadataEnabled(input) || !input.metadataBinding?.definitionId) {
    return false;
  }
  if (input.tenantAllowlist !== undefined) {
    const raw = input.tenantAllowlist?.trim();
    if (!raw) {
      return true;
    }
    if (!input.tenantId) {
      return false;
    }
    const allowed = new Set(
      raw
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    );
    return allowed.has(input.tenantId);
  }
  if (isOperatorWorkspaceMetadataTenantAllowlistConfigured()) {
    if (!input.tenantId || !isOperatorWorkspaceMetadataEnabledForTenant(input.tenantId)) {
      return false;
    }
  }
  return true;
}

/**
 * P5-B-N-009 — operator web plugin resolve: metadata path when flag + binding (+ allowlist);
 * otherwise package registry loader (Strangler Fig facade mirroring API tenant resolve).
 */
export async function resolveOperatorWorkspacePlugin(
  input: ResolveOperatorWorkspacePluginInput
): Promise<WorkspacePlugin> {
  const loadPackage = input.loadPackagePlugin ?? loadWorkspacePluginById;
  const packagePlugin = await loadPackage(input.pluginId);

  if (!shouldUseOperatorMetadataPath(input)) {
    return packagePlugin;
  }

  const loadMetadata =
    input.loadMetadataPayload ??
    (async () => {
      throw new Error("OPERATOR_METADATA_LOADER_NOT_CONFIGURED");
    });

  const payload = await loadMetadata(input.metadataBinding);
  if (!payload) {
    throw new Error(`WORKSPACE_DEFINITION_NOT_FOUND:${input.metadataBinding.definitionId}`);
  }

  const adapt = input.adaptMetadata ?? adaptMetadataPayloadToWorkspacePlugin;
  return adapt(payload, packagePlugin);
}
