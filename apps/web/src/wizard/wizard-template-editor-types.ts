export type WizardTemplateFieldDisplayHints = {
  readonly parentLabel: string | null;
  readonly includesLabels: readonly string[];
  readonly createTourHint: string | null;
};

export type WizardTemplateCatalogFieldMeta = {
  readonly parentCanonicalPath?: string;
  readonly templateFrozen?: boolean;
  readonly templateFrozenRequired?: boolean;
  readonly registryDefaultRequired?: boolean;
  readonly includesCanonicalPaths?: readonly string[];
};

export type WizardTemplateFieldDisplayHints = {
  readonly parentLabel: string | null;
  readonly includesLabels: readonly string[];
  readonly createTourHint: string | null;
};

export type WizardTemplateEditorSurface = {
  readonly messageNamespace: string;
  readonly photosStepId: string;
  readonly isLongDescriptionVisible: (fieldRulesOverlay: unknown) => boolean;
  readonly patchLongDescriptionVisibility: (
    fieldRulesOverlay: Record<string, unknown> | undefined,
    visible: boolean
  ) => Record<string, unknown>;
  readonly resolveCatalogFieldMeta: (
    canonicalPath: string,
    stepId: string,
    stepFieldPaths: readonly string[]
  ) => WizardTemplateCatalogFieldMeta | null;
  readonly isFrozenTemplateCanonicalPath: (canonicalPath: string) => boolean;
  readonly normalizePublishedPayloadSteps: <T extends { published?: boolean }>(payload: T) => T;
};
