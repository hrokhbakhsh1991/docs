import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { parseWizardTemplateResponse } from "@/features/settings/wizard-template-logic";
import type {
  WizardTemplateConfigResponse,
  WizardTemplateFieldRef,
  WizardTemplatePayload,
  WizardTemplateStepRef,
} from "@/features/settings/wizard-template-types";

import { resolveWizardTemplateSeedCanonicalPath } from "./wizard-template-prefill-logic";

export const WIZARD_TEMPLATE_GATE_TEST_IDS = {
  emptyState: "operator-wizard-template-empty-state",
  configureLink: "operator-wizard-template-configure-link",
  unpublishedBanner: "operator-wizard-template-unpublished-banner",
} as const;

export type WizardTemplateGateState = {
  readonly loading: boolean;
  readonly published: boolean;
  readonly allowedCanonicalPaths: readonly string[];
  readonly templateSteps: readonly WizardTemplateStepRef[];
  readonly fieldOverlays: ReadonlyMap<string, WizardTemplateFieldRef>;
  readonly seedLabel: string;
  readonly fieldRulesOverlay: Readonly<Record<string, unknown>>;
  readonly workspaceFormProfile: string;
};

export function buildWizardTemplateFieldOverlays(
  templateSteps: readonly WizardTemplateStepRef[]
): ReadonlyMap<string, WizardTemplateFieldRef> {
  const overlays = new Map<string, WizardTemplateFieldRef>();
  for (const step of templateSteps) {
    if (step.enabled === false) {
      continue;
    }
    for (const field of step.fields) {
      if (field.hidden === true) {
        continue;
      }
      const path = field.canonicalPath.trim();
      if (path.length === 0) {
        continue;
      }
      overlays.set(path, normalizeWizardTemplateFieldRef(field));
    }
  }
  return overlays;
}

export function resolvePublishedWizardTemplateSteps(
  payload: WizardTemplatePayload
): readonly WizardTemplateStepRef[] {
  if (!isWizardTemplatePublished(payload)) {
    return [];
  }
  return (payload.steps ?? []).filter(isEnabledStep);
}

export function parseWizardTemplatePayloadRecord(payload: unknown): WizardTemplatePayload {
  if (payload === null || typeof payload !== "object") {
    return { seedLabel: "", sections: [], published: false, steps: [] };
  }
  try {
    return parseWizardTemplateResponse(payload as WizardTemplateConfigResponse);
  } catch {
    const record = payload as Record<string, unknown>;
    const inner = record.payload;
    if (inner === null || typeof inner !== "object") {
      return { seedLabel: "", sections: [], published: false, steps: [] };
    }
    return parseWizardTemplatePayloadRecord({
      configKey: "wizard_template",
      configVersion: 1,
      source: "tenant",
      updatedAt: null,
      payload: inner,
    });
  }
}

export function isWizardTemplatePublished(payload: WizardTemplatePayload): boolean {
  return payload.published === true;
}

function isEnabledStep(step: WizardTemplateStepRef): boolean {
  return step.enabled !== false;
}

export function countWizardTemplateSelectedFields(
  steps: WizardTemplatePayload["steps"]
): number {
  return resolveWizardTemplateAllowedPaths({
    seedLabel: "",
    sections: [],
    published: true,
    steps: steps ?? [],
  }).length;
}

export function validateWizardTemplateSavable(payload: WizardTemplatePayload): string | null {
  if (payload.published === true && countWizardTemplateSelectedFields(payload.steps) === 0) {
    return "WIZARD_TEMPLATE_PUBLISH_NO_FIELDS";
  }
  return null;
}

export function resolveWizardTemplateAllowedPaths(
  payload: WizardTemplatePayload
): readonly string[] {
  if (!isWizardTemplatePublished(payload)) {
    return [];
  }

  const paths = new Set<string>();
  for (const step of payload.steps ?? []) {
    if (!isEnabledStep(step)) {
      continue;
    }
    for (const field of step.fields) {
      if (field.hidden === true) {
        continue;
      }
      const path = field.canonicalPath.trim();
      if (path.length > 0) {
        paths.add(path);
      }
    }
  }
  return [...paths];
}

export function buildDefaultPublishedWizardSteps(
  pluginId: string,
  plugin?: Pick<WorkspacePlugin, "wizard" | "fieldRegistry">
): readonly WizardTemplateStepRef[] {
  const titlePath = resolveWizardTemplateSeedCanonicalPath(pluginId, plugin);
  const stepId = plugin?.wizard?.steps?.[0]?.stepId ?? "basics";
  return [
    {
      stepId,
      label: "Basics",
      enabled: true,
      fields: [{ canonicalPath: titlePath }],
    },
  ];
}

export function ensureWizardTemplatePublishablePayload(
  payload: WizardTemplatePayload,
  pluginId: string,
  plugin?: Pick<WorkspacePlugin, "wizard" | "fieldRegistry">
): WizardTemplatePayload {
  if (!payload.published) {
    return payload;
  }
  if (resolveWizardTemplateAllowedPaths({ ...payload, published: true }).length > 0) {
    return payload;
  }
  return {
    ...payload,
    published: true,
    steps: buildDefaultPublishedWizardSteps(pluginId, plugin),
  };
}

export function resolveInitialWorkspaceFormProfile(
  plugin?: Pick<WorkspacePlugin, "wizardHost">
): string {
  const normalize = plugin?.wizardHost?.normalizeWizardTemplateGate;
  if (normalize == null) {
    return "platform_default";
  }
  return normalize({
    published: false,
    templateSteps: [],
    allowedCanonicalPaths: [],
    workspaceFormProfile: "",
    fieldRulesOverlay: {},
    seedLabel: "",
  }).workspaceFormProfile;
}

export function resolveWizardTemplateGateState(
  response: unknown,
  pluginId: string,
  plugin?: Pick<WorkspacePlugin, "wizardHost">
): WizardTemplateGateState {
  const payload = parseWizardTemplatePayloadRecord(response);
  const published = isWizardTemplatePublished(payload);
  const effective = published
    ? ensureWizardTemplatePublishablePayload(payload, pluginId, plugin)
    : payload;
  const templateStepsRaw = published ? resolvePublishedWizardTemplateSteps(effective) : [];
  const fieldRulesOverlay =
    effective.fieldRulesOverlay != null && typeof effective.fieldRulesOverlay === "object"
      ? effective.fieldRulesOverlay
      : {};
  const workspaceFormProfileBase =
    typeof effective.baseProfile === "string" && effective.baseProfile.trim().length > 0
      ? effective.baseProfile.trim()
      : "platform_default";

  const allowedPathsRaw = resolveWizardTemplateAllowedPaths(effective);

  let templateSteps: readonly WizardTemplateStepRef[] = templateStepsRaw;
  let allowedCanonicalPaths: readonly string[] = allowedPathsRaw;
  let workspaceFormProfile = workspaceFormProfileBase;

  const normalize = plugin?.wizardHost?.normalizeWizardTemplateGate;
  if (normalize != null && published) {
    const normalized = normalize({
      published,
      templateSteps: templateStepsRaw,
      allowedCanonicalPaths: allowedPathsRaw,
      workspaceFormProfile: workspaceFormProfileBase,
      fieldRulesOverlay,
      seedLabel: effective.seedLabel.trim(),
    });
    templateSteps = normalized.templateSteps as readonly WizardTemplateStepRef[];
    allowedCanonicalPaths = normalized.allowedCanonicalPaths as readonly string[];
    workspaceFormProfile = normalized.workspaceFormProfile;
  }

  return {
    loading: false,
    published,
    allowedCanonicalPaths,
    templateSteps,
    fieldOverlays: buildWizardTemplateFieldOverlays(templateSteps),
    seedLabel: effective.seedLabel.trim(),
    fieldRulesOverlay,
    workspaceFormProfile,
  };
}

type RenderPlanFieldLike = {
  readonly canonicalPath: string;
  readonly required?: boolean;
};

type RenderPlanStepLike = {
  readonly stepId: string;
  readonly fields: readonly RenderPlanFieldLike[];
};

export function applyWizardTemplateToRenderPlan<
  TStep extends RenderPlanStepLike,
  TField extends TStep["fields"][number],
>(
  steps: readonly TStep[],
  templateSteps: readonly WizardTemplateStepRef[],
  fieldOverlays: ReadonlyMap<string, WizardTemplateFieldRef> = buildWizardTemplateFieldOverlays(
    templateSteps
  )
): readonly TStep[] {
  if (templateSteps.length === 0) {
    return [];
  }

  const engineStepById = new Map(steps.map((step) => [step.stepId, step]));
  const engineFieldByPath = new Map<string, TField>();
  for (const step of steps) {
    for (const field of step.fields) {
      engineFieldByPath.set(field.canonicalPath, field as TField);
    }
  }

  const ordered: TStep[] = [];
  for (const templateStep of templateSteps) {
    if (templateStep.enabled === false) {
      continue;
    }
    const engineStep =
      engineStepById.get(templateStep.stepId) ??
      ({ stepId: templateStep.stepId, fields: [] } as unknown as TStep);

    const orderedFields: TField[] = [];
    for (const templateField of templateStep.fields) {
      if (templateField.hidden === true) {
        continue;
      }
      const path = templateField.canonicalPath.trim();
      if (path.length === 0) {
        continue;
      }
      const engineField = engineFieldByPath.get(path);
      if (engineField === undefined) {
        continue;
      }
      const overlay = fieldOverlays.get(path);
      orderedFields.push({
        ...engineField,
        ...(overlay?.required !== undefined ? { required: overlay.required } : {}),
      });
    }

    if (orderedFields.length > 0) {
      ordered.push({ ...engineStep, fields: orderedFields });
    }
  }

  return ordered;
}

/**
 * Layer C review step — injected by the wizard host when `usesReviewStep` is true.
 * Tenant template payloads omit `review` (INV-WIZ-002); publishStatus lives on the engine plan.
 */
export function appendWorkspaceReviewStepToRenderPlan<
  TStep extends RenderPlanStepLike,
  TField extends TStep["fields"][number],
>(
  steps: readonly TStep[],
  engineSteps: readonly TStep[],
  reviewStepId: string,
  reviewFieldCanonicalPath = "publishStatus"
): readonly TStep[] {
  if (steps.some((step) => step.stepId === reviewStepId)) {
    return steps;
  }

  let reviewField: TField | undefined;
  for (const step of engineSteps) {
    for (const field of step.fields) {
      if (field.canonicalPath === reviewFieldCanonicalPath) {
        reviewField = {
          ...field,
          required: true,
        } as TField;
        break;
      }
    }
    if (reviewField != null) {
      break;
    }
  }

  if (reviewField == null) {
    return steps;
  }

  const reviewStep = {
    stepId: reviewStepId,
    fields: [reviewField],
  } as unknown as TStep;

  return [...steps, reviewStep];
}

export function filterRenderPlanByCanonicalPaths<
  T extends { readonly fields: readonly { readonly canonicalPath: string }[] },
>(steps: readonly T[], allowedPaths: readonly string[]): readonly T[] {
  if (allowedPaths.length === 0) {
    return [];
  }
  const allowed = new Set(allowedPaths);
  return steps
    .map((step) => ({
      ...step,
      fields: step.fields.filter((field) => allowed.has(field.canonicalPath)),
    }))
    .filter((step) => step.fields.length > 0);
}

export function normalizeWizardTemplateFieldRef(
  field: WizardTemplateFieldRef
): WizardTemplateFieldRef {
  return {
    canonicalPath: field.canonicalPath.trim(),
    ...(field.required !== undefined ? { required: field.required } : {}),
    ...(field.hidden !== undefined ? { hidden: field.hidden } : {}),
    ...(field.defaultValue !== undefined ? { defaultValue: field.defaultValue } : {}),
  };
}
