import {
  getCanonicalStringFromDraft,
  getCanonicalValueFromDraft,
  setCanonicalValueOnDraft,
  type CanonicalWizardDraftEnvelope,
} from "../wizard/canonical-draft-access";

/** Denali operator wizard draft — canonical `data` bag (workspace-owned; not shell `TourWizardDraft`). */
export type DenaliTourWizardDraft = CanonicalWizardDraftEnvelope;

export function emptyDenaliTourWizardDraft(): DenaliTourWizardDraft {
  return { data: {} };
}

export function getCanonicalStringValue(
  draft: DenaliTourWizardDraft,
  canonicalPath: string
): string {
  return getCanonicalStringFromDraft(draft, canonicalPath);
}

export function getCanonicalValue(draft: DenaliTourWizardDraft, canonicalPath: string): unknown {
  return getCanonicalValueFromDraft(draft, canonicalPath);
}

export function setCanonicalStringValue(
  draft: DenaliTourWizardDraft,
  canonicalPath: string,
  value: string
): DenaliTourWizardDraft {
  return setCanonicalValueOnDraft(draft, canonicalPath, value);
}

export function setCanonicalValue(
  draft: DenaliTourWizardDraft,
  canonicalPath: string,
  value: unknown
): DenaliTourWizardDraft {
  return setCanonicalValueOnDraft(draft, canonicalPath, value);
}
