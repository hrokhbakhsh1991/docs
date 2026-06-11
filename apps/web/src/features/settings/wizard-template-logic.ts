import {
  DEFAULT_WIZARD_TEMPLATE_SECTIONS,
  WIZARD_TEMPLATE_CONFIG_VERSION,
  type WizardTemplateConfigResponse,
  type WizardTemplatePayload,
} from "./wizard-template-types";

export function buildWizardTemplatePutBody(payload: WizardTemplatePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    seedLabel: payload.seedLabel.trim(),
    sections: payload.sections.map((section) => ({ ...section })),
  };
  if (payload.published === true) {
    body.published = true;
  }
  if (payload.steps !== undefined && payload.steps.length > 0) {
    body.steps = payload.steps.map((step) => ({
      stepId: step.stepId,
      label: step.label,
      enabled: step.enabled,
      fields: step.fields.map((field) => ({ ...field })),
    }));
  }
  if (payload.fieldRulesOverlay !== undefined) {
    body.fieldRulesOverlay = { ...payload.fieldRulesOverlay };
  }
  if (typeof payload.baseProfile === "string" && payload.baseProfile.trim().length > 0) {
    body.baseProfile = payload.baseProfile.trim();
  }
  return {
    configVersion: WIZARD_TEMPLATE_CONFIG_VERSION,
    payload: body,
  };
}

function parseWizardTemplateSteps(raw: unknown): WizardTemplatePayload["steps"] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((step): step is Record<string, unknown> => typeof step === "object" && step !== null)
    .map((step) => ({
      stepId: typeof step.stepId === "string" ? step.stepId : "step",
      label: typeof step.label === "string" ? step.label : "Step",
      enabled: step.enabled !== false,
      fields: Array.isArray(step.fields)
        ? step.fields
            .filter(
              (field): field is Record<string, unknown> =>
                typeof field === "object" && field !== null
            )
            .map((field) => ({
              canonicalPath:
                typeof field.canonicalPath === "string" ? field.canonicalPath.trim() : "",
              ...(field.required === true ? { required: true } : {}),
              ...(field.hidden === true ? { hidden: true } : {}),
              ...(typeof field.defaultValue === "string"
                ? { defaultValue: field.defaultValue }
                : {}),
            }))
            .filter((field) => field.canonicalPath.length > 0)
        : [],
    }));
}

function parseFieldRulesOverlay(
  raw: unknown
): Readonly<Record<string, unknown>> | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  return raw as Readonly<Record<string, unknown>>;
}

export function parseWizardTemplateResponse(
  response: WizardTemplateConfigResponse
): WizardTemplatePayload {
  const payload = response.payload as WizardTemplatePayload;
  const fieldRulesOverlay = parseFieldRulesOverlay(
    (payload as { fieldRulesOverlay?: unknown }).fieldRulesOverlay
  );
  const baseProfile =
    typeof (payload as { baseProfile?: unknown }).baseProfile === "string"
      ? (payload as { baseProfile: string }).baseProfile.trim()
      : undefined;

  return {
    seedLabel: payload.seedLabel ?? "",
    sections:
      payload.sections !== undefined && payload.sections.length > 0
        ? payload.sections
        : DEFAULT_WIZARD_TEMPLATE_SECTIONS.map((section) => ({ ...section })),
    published: payload.published === true,
    steps: parseWizardTemplateSteps(payload.steps),
    ...(fieldRulesOverlay !== undefined ? { fieldRulesOverlay } : {}),
    ...(baseProfile !== undefined && baseProfile.length > 0 ? { baseProfile } : {}),
  };
}

export function isWizardTemplatePersisted(
  before: WizardTemplatePayload,
  after: WizardTemplatePayload
): boolean {
  return before.seedLabel !== after.seedLabel && after.seedLabel.length > 0;
}

export function toggleWizardTemplateSection(
  payload: WizardTemplatePayload,
  sectionId: string,
  enabled: boolean
): WizardTemplatePayload {
  return {
    ...payload,
    sections: payload.sections.map((section) =>
      section.id === sectionId ? { ...section, enabled } : section
    ),
  };
}
