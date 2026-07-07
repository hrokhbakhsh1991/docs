import {
  emptyDenaliTourWizardDraft,
  type DenaliTourWizardDraft,
} from "../../draft/denali-tour-wizard-draft";
import { applyDenaliDefaultTourKind } from "../logic/denali-default-tour-kind";

export type DenaliTemplateGatePrefill = {
  readonly seedLabel: string;
  readonly fieldOverlays: ReadonlyMap<string, { readonly defaultValue?: string }>;
};

export type ApplyDenaliTemplatePrefill = (
  draft: DenaliTourWizardDraft,
  gate: DenaliTemplateGatePrefill
) => DenaliTourWizardDraft;

export function buildDenaliCreatePrefilledForm(
  gate: DenaliTemplateGatePrefill,
  applyTemplatePrefill: ApplyDenaliTemplatePrefill
): DenaliTourWizardDraft {
  const base = applyDenaliDefaultTourKind(emptyDenaliTourWizardDraft());
  return applyTemplatePrefill(base, gate);
}
