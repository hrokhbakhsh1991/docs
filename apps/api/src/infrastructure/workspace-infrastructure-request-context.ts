/**
 * MAT-010 — request-scoped infrastructure context (infra adapter layer only).
 */
import { AsyncLocalStorage } from "node:async_hooks";

import {
  createWorkspaceBindingId,
  resolveWorkspaceInfrastructure,
  type WorkspaceInfrastructureResolution,
} from "@app-tour/tenant-kernel";

import {
  loadWorkspaceInfrastructureRegistry,
  resolveRegistryDatabaseTargets,
  resolveRegistryDeploymentStamps,
  resolveRegistrySharedDefaults,
  resolveWorkspacePlacementFromRegistry,
} from "./workspace-infrastructure-registry";

const infrastructureContextStorage = new AsyncLocalStorage<WorkspaceInfrastructureResolution>();

export async function runWithWorkspaceInfrastructureContext<T>(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly manifestFingerprint: string;
  readonly releaseSha?: string;
  readonly profilePin?: { readonly id: string; readonly profileVersion: number };
  readonly capabilityPins?: Readonly<Record<string, { readonly revision: number }>>;
  readonly workspacePolicyBindingId?: string;
  readonly brandingConfigHash?: string;
  readonly run: () => Promise<T>;
}): Promise<T> {
  const registry = loadWorkspaceInfrastructureRegistry();
  const placement = resolveWorkspacePlacementFromRegistry({
    tenantId: input.tenantId,
    workspaceType: input.workspaceType,
  });
  const workspaceBindingId = createWorkspaceBindingId(input.tenantId, input.workspaceType);
  const resolution = resolveWorkspaceInfrastructure({
    workspaceBindingId,
    workspaceType: input.workspaceType.trim().toLowerCase(),
    placement,
    bundle: {
      manifestFingerprint: input.manifestFingerprint,
      releaseSha: input.releaseSha ?? process.env.GIT_SHA?.trim() ?? "dev-local",
      ...(input.profilePin !== undefined ? { profilePin: input.profilePin } : {}),
      ...(input.capabilityPins !== undefined ? { capabilityPins: input.capabilityPins } : {}),
      ...(input.workspacePolicyBindingId !== undefined
        ? { workspacePolicyBindingId: input.workspacePolicyBindingId }
        : {}),
      ...(input.brandingConfigHash !== undefined
        ? { brandingConfigHash: input.brandingConfigHash }
        : {}),
    },
    sharedDefaults: resolveRegistrySharedDefaults(registry),
    databaseTargets: resolveRegistryDatabaseTargets(registry),
    deploymentStamps: resolveRegistryDeploymentStamps(registry),
  });

  return infrastructureContextStorage.run(resolution, input.run);
}

export function getActiveWorkspaceInfrastructure(): WorkspaceInfrastructureResolution | undefined {
  return infrastructureContextStorage.getStore();
}

export function requireActiveWorkspaceInfrastructure(): WorkspaceInfrastructureResolution {
  const context = getActiveWorkspaceInfrastructure();
  if (context === undefined) {
    throw new Error("WORKSPACE_INFRASTRUCTURE_CONTEXT_NOT_BOUND");
  }
  return context;
}

/** Infra adapter helper — maps placement resolution to tenant route database URL. */
export function resolveActiveInfrastructureDatabaseUrl(): string | undefined {
  return getActiveWorkspaceInfrastructure()?.endpoints.databaseUrl;
}
