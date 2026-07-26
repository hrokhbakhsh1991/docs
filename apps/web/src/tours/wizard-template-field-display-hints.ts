import type {
  WizardTemplateCatalogFieldMeta,
  WizardTemplateEditorSurface,
  WizardTemplateFieldDisplayHints,
} from "@/wizard/wizard-template-editor-types";

type WizardTemplateTranslator = (key: string, values?: Record<string, string | number>) => string;

function compositeIdToSectionTitleKey(compositeId: string, pluginId: string): string {
  const prefix = `${pluginId}.`;
  const slug = compositeId.startsWith(prefix) ? compositeId.slice(prefix.length) : compositeId;
  const camel = slug.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
  return `composites.${camel}.sectionTitle`;
}

export function resolveTemplateCompositeSectionLabel(
  editor: WizardTemplateEditorSurface,
  tWorkspace: WizardTemplateTranslator,
  anchorCanonicalPath: string,
  pluginId: string
): string | null {
  const compositeId = editor.resolveCompositeRendererIdForAnchor(anchorCanonicalPath);
  if (compositeId == null) {
    return null;
  }
  const sectionKey = compositeIdToSectionTitleKey(compositeId, pluginId);
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
  meta: WizardTemplateCatalogFieldMeta,
  pluginId: string
): WizardTemplateFieldDisplayHints | null {
  if (editor == null) {
    return null;
  }
  return resolveWizardTemplateFieldDisplayHintsFromMeta(
    editor,
    tSettings,
    tWorkspace,
    resolveFieldLabel,
    meta,
    pluginId
  );
}

export function resolveWizardTemplateFieldDisplayHintsFromMeta(
  editor: WizardTemplateEditorSurface,
  tSettings: WizardTemplateTranslator,
  tWorkspace: WizardTemplateTranslator,
  resolveFieldLabel: (canonicalPath: string) => string,
  meta: WizardTemplateCatalogFieldMeta,
  pluginId: string
): WizardTemplateFieldDisplayHints {
  let parentLabel: string | null = null;
  if (meta.parentCanonicalPath != null) {
    parentLabel =
      resolveTemplateCompositeSectionLabel(
        editor,
        tWorkspace,
        meta.parentCanonicalPath,
        pluginId
      ) ?? resolveFieldLabel(meta.parentCanonicalPath);
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
