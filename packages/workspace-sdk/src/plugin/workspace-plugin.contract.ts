import type { WorkspaceFieldRegistry } from "../registry/field-registry";
import type { WorkspaceRuleSet } from "../registry/rule-set";
import type { WorkspaceLifecycleContract } from "./workspace-lifecycle";
import type { WorkspacePluginId } from "./workspace-plugin-id";
import type { WorkspaceTypeId } from "./workspace-type-id";
import type { WorkspaceValidationHooks } from "./workspace-validation";
import type { WorkspaceThemeContract } from "../theme/workspace-theme.contract";
import type { WorkspaceWizardSurface } from "./workspace-wizard-surface";

/**
 * Workspace plugin contract.
 *
 * Platform code depends on this interface; concrete workspaces implement it
 * under `packages/workspaces/*` without coupling core to a business model.
 */
export interface WorkspacePlugin {
  readonly id: WorkspacePluginId;
  readonly version: number;
  /** SDK major — bump when `WorkspacePlugin` shape breaks (MAP §8). */
  readonly contractVersion: 1;
  readonly supportedWorkspaceTypes: readonly WorkspaceTypeId[];
  readonly fieldRegistry: WorkspaceFieldRegistry;
  readonly ruleSet: WorkspaceRuleSet;
  readonly wizard: WorkspaceWizardSurface;
  readonly validation: WorkspaceValidationHooks;
  readonly lifecycle: WorkspaceLifecycleContract;
  /** Optional workspace brand tokens (`--ws-*` CSS variables). */
  readonly theme?: WorkspaceThemeContract;
}
