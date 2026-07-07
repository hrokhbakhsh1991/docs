export type ValidationIssue = {
  readonly path: string;
  readonly message: string;
  readonly stepId?: string;
  /** Platform / workspace violation code for i18n lookup (Phase 2). */
  readonly code?: string;
};

export type FieldFocusRegistry = {
  resolveSelectors(path: string): readonly string[];
};

export type FocusWizardFieldOptions = {
  readonly root?: ParentNode | null;
  readonly scroll?: boolean;
  readonly scrollBehavior?: ScrollBehavior;
  readonly scrollBlock?: ScrollLogicalPosition;
  readonly highlight?: boolean;
};

export type GoToStepFn = (stepId: string) => void | Promise<void>;

export const WIZARD_FIELD_PATH_ATTR = "data-field-path" as const;
export const WIZARD_FIELD_ID_ATTR = "data-field-id" as const;
