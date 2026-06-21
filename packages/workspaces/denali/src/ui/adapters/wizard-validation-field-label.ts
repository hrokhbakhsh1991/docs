import { createDenaliFieldLabelResolver } from "../surfaces/field-label-resolver";

/** Resolve a human field label for Denali validation issue rows. */
export function resolveDenaliWizardValidationFieldLabel(input: {
  readonly canonicalPath: string;
  readonly translateWorkspaceMessage?: (key: string) => string;
}): string {
  if (input.translateWorkspaceMessage != null) {
    return createDenaliFieldLabelResolver().resolveFieldLabel(
      input.translateWorkspaceMessage,
      input.canonicalPath
    );
  }
  return input.canonicalPath;
}
