export type ValidationIssue = {
  readonly path: string;
  readonly message: string;
  readonly stepId?: string;
};

export type FieldFocusRegistry = {
  resolveSelectors(path: string): readonly string[];
};

export type FocusWizardFieldOptions = {
  readonly root?: ParentNode | null;
  readonly scroll?: boolean;
  readonly scrollBehavior?: ScrollBehavior;
};

export type GoToStepFn = (stepId: string) => void | Promise<void>;

export const WIZARD_FIELD_PATH_ATTR = "data-field-path" as const;
export const WIZARD_FIELD_ID_ATTR = "data-field-id" as const;
