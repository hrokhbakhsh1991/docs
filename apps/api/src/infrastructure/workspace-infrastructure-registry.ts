/**
 * MAT-010 / MAT-013 — control-plane workspace infrastructure registry loader.
 * Business manifests remain separate; credentials remain external (env / secret store).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  DeploymentStampCatalog,
  InfrastructureTargetCatalog,
  RegionId,
  WorkspaceInfrastructurePlacement,
} from "@app-tour/tenant-kernel";

export type WorkspaceInfrastructureRegistryDocument = {
  readonly defaultRegion: RegionId;
  readonly sharedDefaults: {
    readonly poolDatabaseUrlEnv: string;
    readonly cacheNamespace?: string;
    readonly storageNamespace?: string;
    readonly queueNamespace?: string;
    readonly secretsRef?: string;
    readonly monitoringIdentity?: string;
  };
  readonly workspacePlacements: Readonly<Record<string, WorkspaceInfrastructurePlacement>>;
  readonly tenantOverrides?: Readonly<Record<string, WorkspaceInfrastructurePlacement>>;
  readonly databaseTargets?: InfrastructureTargetCatalog;
  readonly deploymentStamps?: DeploymentStampCatalog;
};

let cachedRegistry: WorkspaceInfrastructureRegistryDocument | undefined;

function resolveMonorepoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
}

function resolveRegistryPath(): string {
  const configured = process.env.WORKSPACE_INFRASTRUCTURE_REGISTRY_PATH?.trim();
  if (configured !== undefined && configured.length > 0) {
    return resolve(configured);
  }
  return resolve(resolveMonorepoRoot(), "infra/workspace-infrastructure-registry.defaults.json");
}

function readEnvUrl(envKey: string | undefined): string | undefined {
  if (envKey === undefined || envKey.trim().length === 0) {
    return undefined;
  }
  const value = process.env[envKey]?.trim();
  return value !== undefined && value.length > 0 ? value : undefined;
}

export function loadWorkspaceInfrastructureRegistry(): WorkspaceInfrastructureRegistryDocument {
  if (cachedRegistry !== undefined) {
    return cachedRegistry;
  }
  const raw = readFileSync(resolveRegistryPath(), "utf8");
  cachedRegistry = JSON.parse(raw) as WorkspaceInfrastructureRegistryDocument;
  return cachedRegistry;
}

/** Test-only — reset cached registry between specs. */
export function resetWorkspaceInfrastructureRegistryForTests(): void {
  cachedRegistry = undefined;
}

export function resolveWorkspacePlacementFromRegistry(input: {
  readonly tenantId: string;
  readonly workspaceType: string;
}): WorkspaceInfrastructurePlacement {
  const registry = loadWorkspaceInfrastructureRegistry();
  const tenantOverride = registry.tenantOverrides?.[input.tenantId.trim()];
  if (tenantOverride !== undefined) {
    return tenantOverride;
  }
  const workspacePlacement = registry.workspacePlacements[input.workspaceType.trim().toLowerCase()];
  if (workspacePlacement === undefined) {
    throw new Error("WORKSPACE_INFRASTRUCTURE_PLACEMENT_NOT_FOUND");
  }
  return workspacePlacement;
}

export function resolveRegistryDatabaseTargets(
  registry: WorkspaceInfrastructureRegistryDocument
): InfrastructureTargetCatalog {
  const targets: Record<string, { region: RegionId; databaseUrl?: string }> = {};
  for (const [id, row] of Object.entries(registry.databaseTargets ?? {})) {
    const envRow = row as { region: RegionId; databaseUrlEnv?: string; databaseUrl?: string };
    const databaseUrl = envRow.databaseUrl ?? readEnvUrl(envRow.databaseUrlEnv);
    targets[id] = {
      region: envRow.region,
      ...(databaseUrl !== undefined ? { databaseUrl } : {}),
    };
  }
  return targets;
}

export function resolveRegistryDeploymentStamps(
  registry: WorkspaceInfrastructureRegistryDocument
): DeploymentStampCatalog {
  const stamps: DeploymentStampCatalog = {};
  for (const [id, row] of Object.entries(registry.deploymentStamps ?? {})) {
    const envRow = row as DeploymentStampCatalog[string] & { releaseShaEnv?: string };
    const releaseSha =
      envRow.releaseSha ??
      readEnvUrl(envRow.releaseShaEnv) ??
      process.env.GIT_SHA?.trim() ??
      "dev-local";
    stamps[id] = {
      ...row,
      releaseSha,
    };
  }
  return stamps;
}

export function resolveRegistrySharedDefaults(registry: WorkspaceInfrastructureRegistryDocument): {
  readonly poolDatabaseUrl: string;
  readonly homeRegion: RegionId;
  readonly cacheNamespace?: string;
  readonly storageNamespace?: string;
  readonly queueNamespace?: string;
  readonly secretsRef?: string;
  readonly monitoringIdentity?: string;
} {
  const poolDatabaseUrl = readEnvUrl(registry.sharedDefaults.poolDatabaseUrlEnv);
  if (poolDatabaseUrl === undefined) {
    throw new Error("WORKSPACE_INFRASTRUCTURE_POOL_DATABASE_URL_REQUIRED");
  }
  return {
    poolDatabaseUrl,
    homeRegion: registry.defaultRegion,
    cacheNamespace: registry.sharedDefaults.cacheNamespace,
    storageNamespace: registry.sharedDefaults.storageNamespace,
    queueNamespace: registry.sharedDefaults.queueNamespace,
    secretsRef: registry.sharedDefaults.secretsRef,
    monitoringIdentity: registry.sharedDefaults.monitoringIdentity,
  };
}
