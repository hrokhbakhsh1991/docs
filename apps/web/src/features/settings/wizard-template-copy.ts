/** Message keys under `settings.wizardTemplate` in `messages/{locale}/settings.json`. */

export const WIZARD_TEMPLATE_MESSAGE_KEYS = {
  title: "title",
  subtitle: "subtitle",
  cardTitle: "cardTitle",
  cardDescription: "cardDescription",
  seedLabel: "seedLabel",
  seedHelper: "seedHelper",
  seedPlaceholder: "seedPlaceholder",
  publishLabel: "publishLabel",
  publishHelper: "publishHelper",
  fieldsHeading: "fieldsHeading",
  fieldsHelper: "fieldsHelper",
  searchPlaceholder: "searchPlaceholder",
  selectedCount: "selectedCount",
  requiredLabel: "requiredLabel",
  defaultLabel: "defaultLabel",
  saveButton: "saveButton",
  loadFullTemplateButton: "loadFullTemplateButton",
  loadFullTemplateHelper: "loadFullTemplateHelper",
  success: "success",
  readOnlyBanner: "readOnlyBanner",
  compositeHint: "compositeHint",
  noSearchResults: "noSearchResults",
  errors: {
    publishNoFields: "errors.publishNoFields",
    loadFailed: "errors.loadFailed",
    saveFailed: "errors.saveFailed",
    loadHttp: "errors.loadHttp",
    saveHttp: "errors.saveHttp",
    enginePlanGap: "errors.enginePlanGap",
  },
} as const;

export class WizardTemplateSaveError extends Error {
  constructor(
    readonly payload: {
      readonly code: string;
      readonly stepId?: string;
      readonly canonicalPath?: string;
    },
    readonly status: number
  ) {
    super(payload.code);
    this.name = "WizardTemplateSaveError";
  }
}

/** @deprecated Use `settings.wizardTemplate` via next-intl. */
export const WIZARD_TEMPLATE_COPY = WIZARD_TEMPLATE_MESSAGE_KEYS;

export type WizardTemplateErrorResolution =
  | { type: "key"; key: string; values?: Record<string, string | number> }
  | { type: "raw"; message: string };

export function resolveWizardTemplateUserError(error: unknown): WizardTemplateErrorResolution {
  if (error instanceof WizardTemplateSaveError) {
    if (error.payload.code === "SETTINGS_WIZARD_ENGINE_PLAN_GAP") {
      return {
        type: "key",
        key: WIZARD_TEMPLATE_MESSAGE_KEYS.errors.enginePlanGap,
        values: {
          path: error.payload.canonicalPath ?? "",
          stepId: error.payload.stepId ?? "",
        },
      };
    }
    return {
      type: "key",
      key: WIZARD_TEMPLATE_MESSAGE_KEYS.errors.saveHttp,
      values: { status: String(error.status) },
    };
  }

  if (!(error instanceof Error)) {
    return { type: "key", key: WIZARD_TEMPLATE_MESSAGE_KEYS.errors.saveFailed };
  }

  const message = error.message;
  if (message === "WIZARD_TEMPLATE_PUBLISH_NO_FIELDS") {
    return { type: "key", key: WIZARD_TEMPLATE_MESSAGE_KEYS.errors.publishNoFields };
  }
  if (message.startsWith("WIZARD_TEMPLATE_HTTP_")) {
    const status = message.replace("WIZARD_TEMPLATE_HTTP_", "");
    return {
      type: "key",
      key: WIZARD_TEMPLATE_MESSAGE_KEYS.errors.loadHttp,
      values: { status },
    };
  }
  if (message.startsWith("WIZARD_TEMPLATE_SAVE_HTTP_")) {
    const status = message.replace("WIZARD_TEMPLATE_SAVE_HTTP_", "");
    return {
      type: "key",
      key: WIZARD_TEMPLATE_MESSAGE_KEYS.errors.saveHttp,
      values: { status },
    };
  }
  if (message === "WIZARD_TEMPLATE_FETCH_FAILED" || message === "WIZARD_TEMPLATE_SAVE_FAILED") {
    return { type: "key", key: WIZARD_TEMPLATE_MESSAGE_KEYS.errors.loadFailed };
  }
  return { type: "raw", message };
}
