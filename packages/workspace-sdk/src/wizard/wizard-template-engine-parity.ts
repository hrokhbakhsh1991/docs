import type { WorkspacePlugin } from "../plugin/workspace-plugin.contract";

export type WizardTemplateFieldRefLike = {
  readonly canonicalPath: string;
  readonly hidden?: boolean;
};

export type WizardTemplateStepRefLike = {
  readonly stepId: string;
  readonly enabled?: boolean;
  readonly fields: readonly WizardTemplateFieldRefLike[];
};

export type WizardTemplateRenderPlanGap = {
  readonly stepId: string;
  readonly canonicalPath: string;
  readonly reason: "unknown_engine_field" | "empty_canonical_path" | "template_field_hidden";
};

export type WizardTemplateEngineSyncError = {
  readonly code: "WIZARD_TEMPLATE_ENGINE_PLAN_GAP";
  readonly stepId: string;
  readonly canonicalPath: string;
};

type RenderPlanFieldLike = {
  readonly canonicalPath: string;
};

type RenderPlanStepLike = {
  readonly stepId: string;
  readonly fields: readonly RenderPlanFieldLike[];
};

/** Baseline matrix dimensions for template↔engine parity (INV-WIZ-014). */
export function resolveWizardTemplateParityBaselineDimensions(
  plugin: Pick<WorkspacePlugin, "ruleSet" | "wizardHost">
): Record<string, string> {
  const hooks = plugin.wizardHost;
  if (hooks?.resolveMatrixDimensionsFromDraft != null) {
    return { ...hooks.resolveMatrixDimensionsFromDraft({}, null) };
  }

  const matrix = plugin.ruleSet.matrixDimensions;
  if (matrix.includes("variant")) {
    return { variant: "default" };
  }
  if (matrix.includes("category") && matrix.includes("duration")) {
    return { category: "mountain", duration: "single_day" };
  }

  const defaultCell = plugin.ruleSet.cells.find(
    (cell) => cell.cellId === plugin.ruleSet.defaultCellId
  );
  if (defaultCell != null) {
    return { ...defaultCell.dimensions };
  }

  return Object.fromEntries(matrix.map((key) => [key, "default"]));
}

export function findWizardTemplateRenderPlanGaps(
  steps: readonly RenderPlanStepLike[],
  templateSteps: readonly WizardTemplateStepRefLike[]
): readonly WizardTemplateRenderPlanGap[] {
  const engineFieldByPath = new Map<string, boolean>();
  for (const step of steps) {
    for (const field of step.fields) {
      engineFieldByPath.set(field.canonicalPath, true);
    }
  }

  const gaps: WizardTemplateRenderPlanGap[] = [];
  for (const templateStep of templateSteps) {
    if (templateStep.enabled === false) {
      continue;
    }
    for (const templateField of templateStep.fields) {
      if (templateField.hidden === true) {
        gaps.push({
          stepId: templateStep.stepId,
          canonicalPath: templateField.canonicalPath,
          reason: "template_field_hidden",
        });
        continue;
      }
      const path = templateField.canonicalPath.trim();
      if (path.length === 0) {
        gaps.push({
          stepId: templateStep.stepId,
          canonicalPath: templateField.canonicalPath,
          reason: "empty_canonical_path",
        });
        continue;
      }
      if (!engineFieldByPath.has(path)) {
        gaps.push({
          stepId: templateStep.stepId,
          canonicalPath: path,
          reason: "unknown_engine_field",
        });
      }
    }
  }
  return gaps;
}

/** Blocking sync errors — visible template fields missing from engine plan (INV-WIZ-014). */
export function listWizardTemplateEnginePlanSyncErrors(
  gaps: readonly WizardTemplateRenderPlanGap[]
): readonly WizardTemplateEngineSyncError[] {
  return gaps
    .filter((gap) => gap.reason === "unknown_engine_field" || gap.reason === "empty_canonical_path")
    .map((gap) => ({
      code: "WIZARD_TEMPLATE_ENGINE_PLAN_GAP" as const,
      stepId: gap.stepId,
      canonicalPath: gap.canonicalPath,
    }));
}
