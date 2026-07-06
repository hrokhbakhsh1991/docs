import type { DenaliWizardTemplateCatalogFieldMeta } from "@app-tour/workspace-denali/settings/wizard-template-catalog-meta";
import { resolveDenaliCompositeRendererIdForAnchor } from "@app-tour/workspace-denali/settings/wizard-template-catalog-meta";
import type { WizardTemplateEditorSurface } from "@/wizard/wizard-template-editor-types";
import type { WizardTemplateFieldDisplayHints } from "@/wizard/wizard-template-editor-types";

type DenaliTranslator = (key: string, values?: Record<string, string | number>) => string;

function compositeIdToSectionTitleKey(compositeId: string): string {
  const slug = compositeId.replace(/^denali\./, "");
  const camel = slug.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
  return `composites.${camel}.sectionTitle`;
}

export function resolveDenaliTemplateCompositeSectionLabel(
  tDenali: DenaliTranslator,
  anchorCanonicalPath: string
): string | null {
  const compositeId = resolveDenaliCompositeRendererIdForAnchor(anchorCanonicalPath);
  if (compositeId == null) {
    return null;
  }
  const sectionKey = compositeIdToSectionTitleKey(compositeId);
  try {
    const label = tDenali(sectionKey);
    if (label !== sectionKey && label.length > 0) {
      return label;
    }
  } catch {
    // fall through
  }
  return null;
}

export type DenaliWizardTemplateFieldDisplayHints = WizardTemplateFieldDisplayHints;

export function resolveWizardTemplateFieldDisplayHints(
  editor: WizardTemplateEditorSurface | null,
  tSettings: (key: string, values?: Record<string, string | number>) => string,
  tDenali: DenaliTranslator,
  resolveFieldLabel: (canonicalPath: string) => string,
  meta: NonNullable<ReturnType<WizardTemplateEditorSurface["resolveCatalogFieldMeta"]>>
): WizardTemplateFieldDisplayHints | null {
  if (editor?.messageNamespace !== "denali") {
    return null;
  }
  return resolveDenaliWizardTemplateFieldDisplayHints(
    tSettings,
    tDenali,
    resolveFieldLabel,
    meta as DenaliWizardTemplateCatalogFieldMeta
  );
}

export function resolveDenaliWizardTemplateFieldDisplayHints(
  tSettings: (key: string, values?: Record<string, string | number>) => string,
  tDenali: DenaliTranslator,
  resolveFieldLabel: (canonicalPath: string) => string,
  meta: DenaliWizardTemplateCatalogFieldMeta
): DenaliWizardTemplateFieldDisplayHints {
  let parentLabel: string | null = null;
  if (meta.parentCanonicalPath != null) {
    parentLabel =
      resolveDenaliTemplateCompositeSectionLabel(tDenali, meta.parentCanonicalPath) ??
      resolveFieldLabel(meta.parentCanonicalPath);
  }

  const includesLabels = meta.compositeChildPaths.map((path) => resolveFieldLabel(path));

  let createTourHint: string | null = null;
  if (meta.templateFrozen) {
    createTourHint = tSettings("hints.templateFrozen");
  } else if (meta.matrixInjectedRequired) {
    createTourHint = tSettings("hints.matrixInjectedRequired");
  } else if (meta.registryDefaultRequired) {
    createTourHint = tSettings("hints.matrixDefaultRequired");
  } else if (meta.contextualWatchCanonical != null && parentLabel != null) {
    createTourHint = tSettings("hints.conditionalOnParent", { parent: parentLabel });
  } else if (!meta.registryDefaultRequired && !meta.isCompositeAnchor) {
    createTourHint = tSettings("hints.optionalAtCreate");
  }

  return {
    parentLabel,
    includesLabels,
    createTourHint,
  };
}
