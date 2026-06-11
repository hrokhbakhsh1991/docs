import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { readDenaliCanonicalBasics } from "./adapters/canonical-basics";
import type { DenaliTourKind } from "./types/legacy/repo-types";

export type DenaliWizardMatrixDimensions = {
  readonly category: string;
  readonly duration: string;
};

const DEFAULT_DENALI_MATRIX_DIMENSIONS: DenaliWizardMatrixDimensions = {
  category: "mountain",
  duration: "single_day",
};

/** Resolve category × duration cell from legacy `basicInfo.tourType` slug. */
export function resolveDenaliWizardDimensionsFromTourKind(
  tourKind: DenaliTourKind | string | undefined
): DenaliWizardMatrixDimensions {
  const basics = readDenaliCanonicalBasics(tourKind as DenaliTourKind | undefined);
  if (basics == null) {
    return DEFAULT_DENALI_MATRIX_DIMENSIONS;
  }
  return { category: basics.category, duration: basics.duration };
}

/** RuleContext dimensions aligned with plugin.ruleSet.matrixDimensions. */
export function resolveDenaliWizardDimensions(
  plugin: WorkspacePlugin,
  validationVariant: "default" | "basic" = "default",
  tourKind?: DenaliTourKind | string
): Record<string, string> {
  const matrix = plugin.ruleSet.matrixDimensions;
  if (matrix.includes("variant")) {
    return { variant: validationVariant };
  }
  if (matrix.includes("category") && matrix.includes("duration")) {
    return resolveDenaliWizardDimensionsFromTourKind(tourKind);
  }
  return Object.fromEntries(matrix.map((key) => [key, validationVariant]));
}
