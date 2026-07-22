import type {
  WizardTemplateCatalogFieldMeta,
  WizardTemplateEditorSurface,
  WizardTemplateFieldDisplayHints,
} from "@/wizard/wizard-template-editor-types";
import { DEFAULT_WIZARD_PLUGIN_ID } from "@/wizard/draft-shell-runtime";

type WizardTemplateTranslator = (key: string, values?: Record<string, string | number>) => string;

function compositeIdToSectionTitleKey(compositeId: string): string {
  const prefix = `${DEFAULT_WIZARD_PLUGIN_ID}.`;
  const slug = compositeId.startsWith(prefix) ? compositeId.slice(prefix.length) : compositeId;
  const camel = slug.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
  return `composites.${camel}.sectionTitle`;
}

export function resolveTemplateCompositeSectionLabel(
  editor: WizardTemplateEditorSurface,
  tWorkspace: WizardTemplateTranslator,
  anchorCanonicalPath: string
): string | null {
  const compositeId = editor.resolveCompositeRendererIdForAnchor(anchorCanonicalPath);
  if (compositeId == null) {
    return null;
  }
  const sectionKey = compositeIdToSectionTitleKey(compositeId);
  try {
    const label = tWorkspace(sectionKey);
    if (label !== sectionKey && label.length > 0) {
      return label;
    }
  } catch {
    // fall through
  }
  return null;
}

export function resolveWizardTemplateFieldDisplayHints(
  editor: WizardTemplateEditorSurface | null,
  tSettings: WizardTemplateTranslator,
  tWorkspace: WizardTemplateTranslator,
  resolveFieldLabel: (canonicalPath: string) => string,
  meta: WizardTemplateCatalogFieldMeta
): WizardTemplateFieldDisplayHints | null {
  if (editor == null) {
    return null;
  }
  return resolveWizardTemplateFieldDisplayHintsFromMeta(
    editor,
    tSettings,
    tWorkspace,
    resolveFieldLabel,
    meta
  );
}

export function resolveWizardTemplateFieldDisplayHintsFromMeta(
  editor: WizardTemplateEditorSurface,
  tSettings: WizardTemplateTranslator,
  tWorkspace: WizardTemplateTranslator,
  resolveFieldLabel: (canonicalPath: string) => string,
  meta: WizardTemplateCatalogFieldMeta
): WizardTemplateFieldDisplayHints {
  let parentLabel: string | null = null;
  if (meta.parentCanonicalPath != null) {
    parentLabel =
      resolveTemplateCompositeSectionLabel(editor, tWorkspace, meta.parentCanonicalPath) ??
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
