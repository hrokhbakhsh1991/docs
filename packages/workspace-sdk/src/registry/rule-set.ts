export interface WorkspaceRuleFieldOverride {
  readonly fieldId: string;
  readonly hidden?: boolean;
  readonly required?: boolean;
}

/** Matrix cell — dimensions map to tag values (tour kind, duration, …). */
export interface WorkspaceRuleCell {
  readonly cellId: string;
  readonly dimensions: Readonly<Record<string, string>>;
  readonly fieldOverrides: readonly WorkspaceRuleFieldOverride[];
}

export interface WorkspaceRuleSet {
  readonly version: number;
  readonly matrixDimensions: readonly string[];
  readonly cells: readonly WorkspaceRuleCell[];
  readonly defaultCellId: string;
}

export function getWorkspaceRuleCell(
  ruleSet: WorkspaceRuleSet,
  cellId: string,
): WorkspaceRuleCell | undefined {
  return ruleSet.cells.find((cell) => cell.cellId === cellId);
}
