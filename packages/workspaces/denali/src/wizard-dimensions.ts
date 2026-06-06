import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

/** RuleContext dimensions aligned with plugin.ruleSet.matrixDimensions. */
export function resolveDenaliWizardDimensions(
  plugin: WorkspacePlugin,
  validationVariant: "default" | "basic" = "default"
): Record<string, string> {
  const matrix = plugin.ruleSet.matrixDimensions;
  if (matrix.includes("variant")) {
    return { variant: validationVariant };
  }
  if (matrix.includes("category") && matrix.includes("duration")) {
    return { category: "mountain", duration: "single_day" };
  }
  return Object.fromEntries(matrix.map((key) => [key, validationVariant]));
}
