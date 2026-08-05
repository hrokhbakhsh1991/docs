import { resolveDenaliFieldLabel } from "./field-labels";

type DenaliTranslator = ((key: string) => string) & {
  readonly has?: (key: string) => boolean;
};

/**
 * Resolve a human field label for Denali validation issue rows.
 *
 * Validation issue paths can be composite renderer ids (e.g. `denali.pricing-participants`)
 * rather than canonical leaf paths (anchors remap via `denaliFieldIdForCanonicalPath`).
 * Prefer the actionable leaf `fields.*` label (same order as `resolveDenaliFieldLabel` /
 * INV-DENALI-WIZ-018) — not the composite group `sectionTitle`.
 */
export function resolveDenaliWizardValidationFieldLabel(input: {
  readonly canonicalPath: string;
  readonly translateWorkspaceMessage?: (key: string) => string;
}): string {
  const translate = input.translateWorkspaceMessage;
  if (translate == null) {
    return input.canonicalPath;
  }
  return resolveDenaliValidationIssueLabel(translate, input.canonicalPath);
}

/** Composite-aware label resolution shared with the web validation surface. */
export function resolveDenaliValidationIssueLabel(
  t: DenaliTranslator,
  pathOrCompositeId: string
): string {
  return resolveDenaliFieldLabel(t, pathOrCompositeId);
}
