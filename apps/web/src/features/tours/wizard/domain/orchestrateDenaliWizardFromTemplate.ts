import { denaliTemplateOrchestratorFactory } from "@repo/denali-domain";
import { templateToCanonical, type DenaliCanonicalTemplateData } from "@repo/types/denali";

import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

export type OrchestrateDenaliWizardResult =
  | { success: true; form: DenaliCreateTourWizardForm }
  | { success: false; errors: readonly string[] };

function extractFormFromDraftState(data: Record<string, unknown>): DenaliCreateTourWizardForm | null {
  const form = data.form;
  if (form == null || typeof form !== "object" || Array.isArray(form)) {
    return null;
  }
  return form as DenaliCreateTourWizardForm;
}

/**
 * Single hydration authority — runs {@link denaliTemplateOrchestratorFactory} in-memory
 * (same pipeline as `POST .../tour-wizard-template/instantiate`, without persisting draft).
 */
export async function orchestrateDenaliWizardFromTemplate(
  template: TenantWizardTemplate,
  canonicalData: Record<string, unknown>,
  options?: { bypassStepIndex?: number },
): Promise<OrchestrateDenaliWizardResult> {
  const result = await denaliTemplateOrchestratorFactory.createDraftFromTemplate(
    {
      workspaceId: template.workspaceId,
      templateId: template.id,
      canonicalData,
      fieldRulesOverlay: { ...template.fieldRulesOverlay },
    },
    { bypassStepIndex: options?.bypassStepIndex },
  );

  if (!result.success) {
    return { success: false, errors: result.errors ?? ["Template orchestration failed."] };
  }

  const form = extractFormFromDraftState(result.draftState.data);
  if (form == null) {
    return { success: false, errors: ["Template factory returned no hydratable wizard form."] };
  }

  return { success: true, form };
}

/** Empty canonical — registry-default shell after factory normalize + prune. */
export function emptyDenaliWizardCanonicalData(): Record<string, unknown> {
  return {};
}

/** Preset canonical patch in template storage shape for factory Layer A validation. */
export function presetCanonicalDataForFactory(
  canonicalData: DenaliCanonicalTemplateData | undefined,
): Record<string, unknown> {
  const patch = templateToCanonical({ canonicalData });
  return patch as Record<string, unknown>;
}
