/**
 * Create-tour rail mode.
 * `schema` = registry-driven multi-step rail (maps to extended rail in API bridge 1.3).
 */
export type WorkspaceWizardMode = "classic" | "schema";

export interface WorkspaceWizardSurface {
  readonly wizardMode: WorkspaceWizardMode;
  readonly railId: string;
  readonly roots: readonly string[];
  readonly inactiveFieldGroups: readonly string[];
  readonly wizardCapacityStepRedundant: boolean;
}
