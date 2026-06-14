import { DENALI_COMPOSITE_BY_CANONICAL_PATH } from "@app-tour/workspace-denali/composites";

import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";

type DenaliTranslator = (key: string) => string;

function compositeIdToSectionTitleMessageKey(compositeId: string): string {
  const slug = compositeId.replace(/^denali\./, "");
  const camel = slug.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
  return `composites.${camel}.sectionTitle`;
}

/** Resolve validation issue labels when fieldId is a Denali composite renderer id. */
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
