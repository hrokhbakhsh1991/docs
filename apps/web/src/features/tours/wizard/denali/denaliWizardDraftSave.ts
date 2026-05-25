import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { isDenaliDraftEnabled } from "@/features/tours/wizard/is-denali-draft-enabled";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";

import {
  clearDenaliWizardDraftFromStorage as clearDenaliWizardDraftFromStorageInternal,
  persistDenaliWizardDraftBackupToStorage,
  persistDenaliWizardDraftToStorage,
  type PersistDenaliWizardDraftOptions,
} from "./safeDraftHydration";

/**
 * Gated Denali wizard draft persist (localStorage).
 * No-op unless {@link isDenaliDraftEnabled} (`NEXT_PUBLIC_ENABLE_DENALI_DRAFT=1` at build).
 */
export function saveDraft(
  storageKey: string,
  formValues: Partial<DenaliCreateTourWizardForm> | DenaliCreateTourWizardForm,
  wizardMeta: TourWizardDraftMeta | undefined,
  options?: PersistDenaliWizardDraftOptions,
): void {
  if (!isDenaliDraftEnabled()) {
    return;
  }
  persistDenaliWizardDraftToStorage(storageKey, formValues, wizardMeta, options);
}

/** Backup slot while an incompatible draft is being migrated (same gate as {@link saveDraft}). */
export function saveDraftBackup(
  storageKey: string,
  formValues: Partial<DenaliCreateTourWizardForm> | DenaliCreateTourWizardForm,
  wizardMeta: TourWizardDraftMeta | undefined,
  options?: PersistDenaliWizardDraftOptions,
): void {
  if (!isDenaliDraftEnabled()) {
    return;
  }
  persistDenaliWizardDraftBackupToStorage(storageKey, formValues, wizardMeta, options);
}

/**
 * Gated Denali wizard draft clear (primary + `:backup` localStorage keys).
 * No-op unless {@link isDenaliDraftEnabled} (`NEXT_PUBLIC_ENABLE_DENALI_DRAFT=1` at build).
 */
export function clearDenaliWizardDraftFromStorage(storageKey: string): void {
  if (!isDenaliDraftEnabled()) {
    return;
  }
  clearDenaliWizardDraftFromStorageInternal(storageKey);
}
