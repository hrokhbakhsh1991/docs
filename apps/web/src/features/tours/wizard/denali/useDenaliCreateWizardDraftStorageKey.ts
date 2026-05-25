"use client";

import { useMemo } from "react";

import { useTourWizardDraftStorageKey } from "@/features/tours/wizard/useTourWizardDraftStorageKey";

import {
  denaliWizardLegacyWorkspaceDraftStorageKey,
  denaliWizardTemplateDraftStorageKey,
} from "./denaliWizardDraftStorageKeys";

/** Template-scoped create draft key with legacy workspace fallback for migration reads. */
export function useDenaliCreateWizardDraftStorageKey(templateId: string | undefined): {
  draftStorageKey: string | undefined;
  legacyDraftStorageKey: string;
} {
  const legacyDraftStorageKey = useTourWizardDraftStorageKey();
  const draftStorageKey = useMemo(() => {
    const id = templateId?.trim();
    if (!id) {
      return undefined;
    }
    return denaliWizardTemplateDraftStorageKey(id);
  }, [templateId]);

  return {
    draftStorageKey,
    legacyDraftStorageKey,
  };
}

export { denaliWizardLegacyWorkspaceDraftStorageKey };
