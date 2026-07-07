import { formatCanonicalPathToLabel } from "@/i18n/format-canonical-path-label";
import { resolveGeneratedLabelResolver } from "@/bootstrap/wizard-label-bindings.generated";

export function resolveWizardFieldLabel(
  surfaceId: string | undefined,
  translate: (key: string) => string,
  canonicalPath: string
): string {
  const resolver = resolveGeneratedLabelResolver(surfaceId);
  if (resolver != null) {
    return resolver.resolveFieldLabel(translate, canonicalPath);
  }
  return formatCanonicalPathToLabel(canonicalPath);
}

export function resolveWizardStepLabel(
  surfaceId: string | undefined,
  translate: (key: string) => string,
  stepId: string
): string {
  const resolver = resolveGeneratedLabelResolver(surfaceId);
  if (resolver?.resolveStepLabel != null) {
    return resolver.resolveStepLabel(translate, stepId);
  }
  return formatCanonicalPathToLabel(stepId);
}

export function resolveWizardEnumOptionLabel(
  surfaceId: string | undefined,
  translate: (key: string) => string,
  canonicalPath: string,
  value: string
): string {
  const resolver = resolveGeneratedLabelResolver(surfaceId);
  if (resolver?.resolveEnumOptionLabel != null) {
    return resolver.resolveEnumOptionLabel(translate, canonicalPath, value);
  }
  return value;
}
