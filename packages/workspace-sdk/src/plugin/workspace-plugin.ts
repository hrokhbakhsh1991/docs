import type { WorkspaceFieldRegistry } from "../registry/field-registry";
import type { WorkspaceRuleSet } from "../registry/rule-set";
import type { WorkspaceLifecycleContract } from "./workspace-lifecycle";
import type { WorkspacePluginId } from "./workspace-plugin-id";
import type { WorkspaceValidationHooks } from "./workspace-validation";
import type { WorkspaceWizardSurface } from "./workspace-wizard-surface";

/**
 * Workspace plugin contract (`map.md` Phase 1 — Contract).
 *
 * Platform code depends on this interface; concrete workspaces (Phase 2+)
 * implement it without coupling core to a specific business model.
 */
export interface WorkspacePlugin {
  readonly id: WorkspacePluginId;
  readonly version: number;
  /** Subset of frozen `TOUR_FORM_PROFILE_VALUES` this plugin serves. */
  readonly supportedProfiles: readonly string[];
  readonly fieldRegistry: WorkspaceFieldRegistry;
  readonly ruleSet: WorkspaceRuleSet;
  readonly wizard: WorkspaceWizardSurface;
  readonly validation: WorkspaceValidationHooks;
  readonly lifecycle: WorkspaceLifecycleContract;
}

export function isWorkspacePlugin(value: unknown): value is WorkspacePlugin {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const candidate = value as WorkspacePlugin;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.version === "number" &&
    Array.isArray(candidate.supportedProfiles) &&
    candidate.fieldRegistry != null &&
    candidate.ruleSet != null &&
    candidate.wizard != null &&
    candidate.validation != null &&
    candidate.lifecycle != null
  );
}
