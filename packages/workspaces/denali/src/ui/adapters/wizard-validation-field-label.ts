import { DENALI_COMPOSITE_BY_CANONICAL_PATH } from "../../composites";

import { compositeIdToSectionTitleMessageKey } from "./denali-composite-label-paths";
import { resolveDenaliFieldLabel } from "./field-labels";

type DenaliTranslator = ((key: string) => string) & {
  readonly has?: (key: string) => boolean;
};

function tryTranslateSectionTitle(t: DenaliTranslator, sectionKey: string): string | null {
  if (t.has != null && !t.has(sectionKey)) {
    return null;
  }
  try {
    const sectionLabel = t(sectionKey);
    // Reject missing-message echoes (raw key or namespaced `denali.composites…` fallback).
    if (
      sectionLabel.length === 0 ||
      sectionLabel === sectionKey ||
      sectionLabel.endsWith(sectionKey) ||
      (sectionLabel.includes(".composites.") && sectionLabel.includes(".sectionTitle"))
    ) {
      return null;
    }
    return sectionLabel;
  } catch {
    // Fall through to canonical anchor lookup.
  }
  return null;
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
    const sectionLabel = tryTranslateSectionTitle(t, sectionKey);
    if (sectionLabel != null) {
      return sectionLabel;
    }

    for (const [canonicalPath, compositeId] of Object.entries(DENALI_COMPOSITE_BY_CANONICAL_PATH)) {
      if (compositeId === pathOrCompositeId) {
        return resolveDenaliFieldLabel(t, canonicalPath);
      }
    }
  }

  return resolveDenaliFieldLabel(t, pathOrCompositeId);
}
