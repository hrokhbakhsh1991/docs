import { resolveWizardCompositeSurface } from "./wizard-composite-surface-registry";

/** Resolve a human field label for validation issue rows (falls back to canonical path). */
export function resolveWizardValidationFieldLabel(input: {
  readonly canonicalPath: string;
  readonly fieldLabelSurfaceId?: string;
  readonly translateWorkspaceMessage?: (key: string) => string;
}): string {
  const labelSurface = resolveWizardCompositeSurface(input.fieldLabelSurfaceId);
  if (labelSurface != null && input.translateWorkspaceMessage != null) {
    return labelSurface.resolveFieldLabel(input.translateWorkspaceMessage, input.canonicalPath);
  }
  return input.canonicalPath;
}
