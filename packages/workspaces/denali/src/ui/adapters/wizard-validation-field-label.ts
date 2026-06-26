import { DENALI_COMPOSITE_BY_CANONICAL_PATH } from "../../composites";

import { resolveDenaliFieldLabel } from "./field-labels";

type DenaliTranslator = (key: string) => string;

function compositeIdToSectionTitleMessageKey(compositeId: string): string {
  const slug = compositeId.replace(/^denali\./, "");
  const camel = slug.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
  return `composites.${camel}.sectionTitle`;
}

/**
 * Resolve a human field label for Denali validation issue rows.
 *
 * Validation issue paths can be composite renderer ids (e.g. `denali.pricing-participants`)
 * rather than canonical leaf paths. For those, prefer the composite `sectionTitle` message,
 * then fall back to the underlying canonical field label, before the raw `fields.*` lookup.
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
  if (pathOrCompositeId.startsWith("denali.")) {
    const sectionKey = compositeIdToSectionTitleMessageKey(pathOrCompositeId);
    try {
      const sectionLabel = t(sectionKey);
      if (sectionLabel !== sectionKey && sectionLabel.length > 0) {
        return sectionLabel;
      }
    } catch {
      // Fall through to canonical anchor lookup.
    }

    for (const [canonicalPath, compositeId] of Object.entries(DENALI_COMPOSITE_BY_CANONICAL_PATH)) {
      if (compositeId === pathOrCompositeId) {
        return resolveDenaliFieldLabel(t, canonicalPath);
      }
    }
  }

  return resolveDenaliFieldLabel(t, pathOrCompositeId);
}
