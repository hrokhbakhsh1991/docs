"use client";

import { useRef, type MutableRefObject } from "react";

import type { DenaliTourWizardDraft } from "../../draft/denali-tour-wizard-draft";

/** Keep wizard draft edits on the latest render snapshot (avoids stale closure during SYNCING). */
export function useLatestWizardDraft(
  draft: DenaliTourWizardDraft
): MutableRefObject<DenaliTourWizardDraft> {
  const draftRef = useRef(draft);
  draftRef.current = draft;
  return draftRef;
}

export function commitWizardDraftEdit(
  draftRef: MutableRefObject<DenaliTourWizardDraft>,
  onDraftChange: (draft: DenaliTourWizardDraft) => void,
  buildNext: (base: DenaliTourWizardDraft) => DenaliTourWizardDraft
): void {
  const next = buildNext(draftRef.current);
  draftRef.current = next;
  onDraftChange(next);
}
