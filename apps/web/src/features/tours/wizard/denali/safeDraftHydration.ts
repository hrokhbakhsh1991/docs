import {
  mergeDenaliWizardDefaults,
  serializeDenaliWizardDraft,
  type ParsedDenaliWizardDraft,
} from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import {
  purgeAllWizardDraftLocalStorageKeys,
  resolveWizardDraftStorageKeyForBrowserHost,
} from "@/features/tours/wizard/tourWizardDraftEnvelope";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";

import { readDenaliPrefillFromLocalStorage } from "./bootstrapDenaliPrefillDraft";
import { denaliDraftHasRestorableContent } from "./denaliWizardDraftRestore";
import {
  getDenaliWizardDraftVersionHash,
  isDenaliWizardDraftVersionCompatible,
} from "./denaliWizardDraftVersion";
import { finalizeDenaliWizardHydration } from "./denaliFormHydration";

export class DenaliDraftVersionMismatchError extends Error {
  readonly name = "DenaliDraftVersionMismatchError";

  constructor(
    message: string,
    readonly storedVersionHash: string | undefined,
    readonly currentVersionHash: string,
  ) {
    super(message);
  }
}

export type HydratedDenaliWizardDraft = {
  formValues: DenaliCreateTourWizardForm;
  wizardMeta?: TourWizardDraftMeta;
};

export type TryHydrateDenaliDraftOptions = {
  /** When true, mismatch throws instead of returning null. */
  throwOnVersionMismatch?: boolean;
};

/**
 * Safe draft hydration: version gate → merge defaults → invariant engine → rule-engine normalize.
 * Returns null when the draft is missing, empty, or structurally incompatible.
 */
export function tryHydrateDraft(
  savedDraft: ParsedDenaliWizardDraft | null | undefined,
  defaults: DenaliCreateTourWizardForm,
  options?: TryHydrateDenaliDraftOptions,
): HydratedDenaliWizardDraft | null {
  if (savedDraft?.formPatch == null) {
    return null;
  }

  if (!denaliDraftHasRestorableContent(savedDraft.formPatch)) {
    return null;
  }

  const currentVersionHash = getDenaliWizardDraftVersionHash();
  const storedVersionHash =
    savedDraft.versionHash ?? savedDraft.formStructureVersionHash;

  if (!isDenaliWizardDraftVersionCompatible(storedVersionHash, currentVersionHash)) {
    if (options?.throwOnVersionMismatch) {
      throw new DenaliDraftVersionMismatchError(
        "Saved draft versionHash does not match the current wizard structure.",
        storedVersionHash,
        currentVersionHash,
      );
    }
    return null;
  }

  const merged = mergeDenaliWizardDefaults(defaults, savedDraft.formPatch);
  const formValues = finalizeDenaliWizardHydration(merged);

  return {
    formValues,
    wizardMeta: savedDraft.wizardMeta,
  };
}

/** True when a parsed draft can be loaded via {@link tryHydrateDraft}. */
export function isDenaliWizardDraftLoadable(
  savedDraft: ParsedDenaliWizardDraft | null | undefined,
): boolean {
  if (savedDraft?.formPatch == null) {
    return false;
  }
  if (!denaliDraftHasRestorableContent(savedDraft.formPatch)) {
    return false;
  }
  const storedVersionHash =
    savedDraft.versionHash ?? savedDraft.formStructureVersionHash;
  return isDenaliWizardDraftVersionCompatible(storedVersionHash);
}

export function readDenaliWizardDraftFromStorage(storageKey: string): ParsedDenaliWizardDraft | null {
  if (typeof window === "undefined") {
    return null;
  }
  return readDenaliPrefillFromLocalStorage(storageKey);
}

export function persistDenaliWizardDraftToStorage(
  storageKey: string,
  formValues: Partial<DenaliCreateTourWizardForm>,
  wizardMeta: TourWizardDraftMeta | undefined,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const resolvedKey = resolveWizardDraftStorageKeyForBrowserHost(storageKey);
  localStorage.setItem(resolvedKey, serializeDenaliWizardDraft(formValues, wizardMeta));
}

export function clearDenaliWizardDraftFromStorage(storageKey: string): void {
  if (typeof window === "undefined") {
    return;
  }
  purgeAllWizardDraftLocalStorageKeys(resolveWizardDraftStorageKeyForBrowserHost(storageKey));
}
