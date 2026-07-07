import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";

import {
  WORKSPACE_PRODUCTION_CERTIFICATION,
  type WorkspaceProductionCertificationTier,
} from "./workspace-production-certification.generated";

export type { WorkspaceProductionCertificationTier };

export class ProductionCertificationNotConfiguredError extends Error {
  readonly code = "PRODUCTION_CERTIFICATION_NOT_CONFIGURED" as const;

  constructor(pluginId: string) {
    super(`PRODUCTION_CERTIFICATION_NOT_CONFIGURED:${pluginId}`);
    this.name = "ProductionCertificationNotConfiguredError";
  }
}

/** Resolve manifest-derived production certification tier for a workspace plugin id. */
export function resolveProductionCertificationForPlugin(
  pluginId: WorkspacePluginId | string
): WorkspaceProductionCertificationTier {
  const tier = WORKSPACE_PRODUCTION_CERTIFICATION[pluginId];
  if (tier === undefined) {
    throw new ProductionCertificationNotConfiguredError(pluginId);
  }
  return tier;
}
