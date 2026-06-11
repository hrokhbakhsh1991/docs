export type WizardTemplateSection = {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
};

export type WizardTemplateFieldRef = {
  readonly canonicalPath: string;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly defaultValue?: string;
};

export type WizardTemplateStepRef = {
  readonly stepId: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly fields: readonly WizardTemplateFieldRef[];
};

export type WizardTemplatePayload = {
  readonly seedLabel: string;
  readonly sections: readonly WizardTemplateSection[];
  readonly published?: boolean;
  readonly steps?: readonly WizardTemplateStepRef[];
  readonly fieldRulesOverlay?: Readonly<Record<string, unknown>>;
  readonly baseProfile?: string;
};

export type WizardTemplateConfigResponse = {
  readonly configKey: string;
  readonly configVersion: number;
  readonly source: "tenant" | "workspace";
  readonly payload: WizardTemplatePayload;
  readonly updatedAt: string | null;
};

export const WIZARD_TEMPLATE_CONFIG_VERSION = 1;

export const WIZARD_TEMPLATE_TEST_IDS = {
  page: "operator-wizard-template-page",
  form: "operator-wizard-template-form",
  seedInput: "operator-wizard-template-seed",
  sectionToggle: "operator-wizard-template-section-toggle",
  publishToggle: "operator-wizard-template-publish",
  saveButton: "operator-wizard-template-save",
  loadFullTemplateButton: "operator-wizard-template-load-full",
  success: "operator-wizard-template-success",
} as const;

export const DEFAULT_WIZARD_TEMPLATE_SECTIONS: readonly WizardTemplateSection[] = [
  { id: "basics", label: "Basics", enabled: true },
  { id: "itinerary", label: "Itinerary", enabled: true },
] as const;
