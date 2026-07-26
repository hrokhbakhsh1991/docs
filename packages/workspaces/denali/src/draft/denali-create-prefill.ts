import {
  emptyDenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
  type DenaliTourWizardDraft,
} from "./denali-tour-wizard-draft";
import { DENALI_WORKSPACE_PLUGIN_ID } from "../denali-identity";
import { applyDenaliDefaultTourKind } from "./denali-default-tour-kind";

export type DenaliTemplateGatePrefill = {
  readonly seedLabel: string;
  readonly fieldOverlays: ReadonlyMap<string, { readonly defaultValue?: string }>;
  /** When true, overlay defaults win over empty draft values (template-first). */
  readonly preferTemplateDefaults?: boolean;
};

export type ApplyDenaliTemplatePrefill = (
  draft: DenaliTourWizardDraft,
  gate: DenaliTemplateGatePrefill
) => DenaliTourWizardDraft;

const SEED_CANONICAL_PATH = "title" as const;

function applyOverlayDefaults(
  draft: DenaliTourWizardDraft,
  fieldOverlays: DenaliTemplateGatePrefill["fieldOverlays"],
  preferTemplateDefaults: boolean
): DenaliTourWizardDraft {
  let next = draft;
  for (const [canonicalPath, overlay] of fieldOverlays) {
    const defaultValue = overlay.defaultValue;
    if (typeof defaultValue !== "string" || defaultValue.length === 0) {
      continue;
    }
    const current = getCanonicalStringValue(next, canonicalPath).trim();
    if (preferTemplateDefaults || current.length === 0) {
      next = setCanonicalStringValue(next, canonicalPath, defaultValue);
    }
  }
  return next;
}

function applyPublishStatusDefault(
  draft: DenaliTourWizardDraft,
  fieldOverlays: DenaliTemplateGatePrefill["fieldOverlays"]
): DenaliTourWizardDraft {
  if (!fieldOverlays.has("publishStatus")) {
    return draft;
  }
  const current = getCanonicalStringValue(draft, "publishStatus").trim();
  if (current.length > 0) {
    return draft;
  }
  return setCanonicalStringValue(draft, "publishStatus", "draft");
}

function applySeedLabel(
  draft: DenaliTourWizardDraft,
  seedLabel: string,
  fieldOverlays: DenaliTemplateGatePrefill["fieldOverlays"]
): DenaliTourWizardDraft {
  const trimmed = seedLabel.trim();
  if (trimmed.length === 0) {
    const overlayDefault = fieldOverlays.get(SEED_CANONICAL_PATH)?.defaultValue;
    if (typeof overlayDefault === "string" && overlayDefault.trim().length > 0) {
      const current = getCanonicalStringValue(draft, SEED_CANONICAL_PATH).trim();
      if (current.length === 0) {
        return setCanonicalStringValue(draft, SEED_CANONICAL_PATH, overlayDefault.trim());
      }
    }
    return draft;
  }
  const current = getCanonicalStringValue(draft, SEED_CANONICAL_PATH).trim();
  if (current.length > 0) {
    return draft;
  }
  return setCanonicalStringValue(draft, SEED_CANONICAL_PATH, trimmed);
}

/** Denali-owned template gate prefill (no apps/web dependency). */
export function applyDenaliTemplateGatePrefill(
  draft: DenaliTourWizardDraft,
  gate: DenaliTemplateGatePrefill
): DenaliTourWizardDraft {
  const preferTemplateDefaults = gate.preferTemplateDefaults === true;
  const withDefaults = applyOverlayDefaults(draft, gate.fieldOverlays, preferTemplateDefaults);
  const withPublish = applyPublishStatusDefault(withDefaults, gate.fieldOverlays);
  return applySeedLabel(withPublish, gate.seedLabel, gate.fieldOverlays);
}

export function buildDenaliCreatePrefilledForm(
  gate: DenaliTemplateGatePrefill,
  applyTemplatePrefill: ApplyDenaliTemplatePrefill = applyDenaliTemplateGatePrefill
): DenaliTourWizardDraft {
  const base = applyDenaliDefaultTourKind(emptyDenaliTourWizardDraft());
  return applyTemplatePrefill(base, gate);
}

/** Convenience for hosts: plugin id is owned by the Denali package, not the shell. */
export const DENALI_CREATE_PREFILL_PLUGIN_ID = DENALI_WORKSPACE_PLUGIN_ID;
