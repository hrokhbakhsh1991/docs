/** Phase 14.0b — plugin hook I/O for operator wizard template gate (DEC-P14-002). */

export type WorkspaceWizardTemplateGateNormalizeInput = {
  readonly published: boolean;
  readonly templateSteps: readonly unknown[];
  readonly allowedCanonicalPaths: readonly string[];
  readonly workspaceFormProfile: string;
  readonly fieldRulesOverlay: Readonly<Record<string, unknown>>;
  readonly seedLabel: string;
};

export type WorkspaceWizardTemplateGateNormalizeResult = {
  readonly templateSteps: readonly unknown[];
  readonly allowedCanonicalPaths: readonly string[];
  readonly workspaceFormProfile: string;
};
