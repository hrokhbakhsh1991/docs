import { formatCanonicalPathToLabel } from "@/i18n/format-canonical-path-label";
import {
  resolveWizardFieldLabel,
  resolveWizardStepLabel,
} from "@/wizard/wizard-label-surface-registry";

export { formatCanonicalPathToLabel };

export function resolveWizardTemplateFieldLabel(
  canonicalPath: string,
  fieldLabelSurfaceId?: string,
  translate?: (key: string) => string
): string {
  if (fieldLabelSurfaceId != null && translate != null) {
    return resolveWizardFieldLabel(fieldLabelSurfaceId, translate, canonicalPath);
  }
  return formatCanonicalPathToLabel(canonicalPath);
}

export function formatWizardTemplateStepLabel(
  stepId: string,
  fieldLabelSurfaceId?: string,
  translate?: (key: string) => string
): string {
  if (fieldLabelSurfaceId != null && translate != null) {
    return resolveWizardStepLabel(fieldLabelSurfaceId, translate, stepId);
  }
  return formatCanonicalPathToLabel(stepId);
}

export function formatWizardTemplateFieldKindLabel(kind: string): string {
  return formatCanonicalPathToLabel(kind);
}

export function resolveWizardTemplateFieldKindLabel(
  kind: string,
  fieldLabelSurfaceId?: string,
  translate?: (key: string) => string
): string {
  if (fieldLabelSurfaceId != null && translate != null) {
    try {
      const label = translate(`fieldKinds.${kind}`);
      if (label !== `fieldKinds.${kind}` && label.length > 0) {
        return label;
      }
    } catch {
      // Missing message keys fall back to formatted kind.
    }
  }
  return formatWizardTemplateFieldKindLabel(kind);
}
