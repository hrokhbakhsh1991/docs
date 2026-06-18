"use client";

import { useRef, type MutableRefObject } from "react";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

/** Keep wizard draft edits on the latest render snapshot (avoids stale closure during SYNCING). */
export function useLatestWizardDraft(draft: TourWizardDraft): MutableRefObject<TourWizardDraft> {
  const draftRef = useRef(draft);
  draftRef.current = draft;
  return draftRef;
}

export function commitWizardDraftEdit(
  draftRef: MutableRefObject<TourWizardDraft>,
  onDraftChange: (draft: TourWizardDraft) => void,
  buildNext: (base: TourWizardDraft) => TourWizardDraft
): void {
  const next = buildNext(draftRef.current);
  draftRef.current = next;
  onDraftChange(next);
}
