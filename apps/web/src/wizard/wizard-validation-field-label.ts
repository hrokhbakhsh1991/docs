import { resolveGeneratedLabelResolver } from "@/bootstrap/wizard-label-bindings.generated";

/** Resolve a human field label for validation issue rows (falls back to canonical path). */
export function resolveWizardValidationFieldLabel(input: {
  readonly canonicalPath: string;
  readonly fieldLabelSurfaceId?: string;
  readonly translateWorkspaceMessage?: (key: string) => string;
}): string {
  const translate = input.translateWorkspaceMessage;
  if (translate == null) {
    return input.canonicalPath;
  }

  const resolver = resolveGeneratedLabelResolver(input.fieldLabelSurfaceId);
  if (resolver?.resolveValidationIssueLabel != null) {
    return resolver.resolveValidationIssueLabel(translate, input.canonicalPath);
  }
  if (resolver != null) {
    return resolver.resolveFieldLabel(translate, input.canonicalPath);
  }
  return input.canonicalPath;
}
