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
import { isDenaliScopedDraftStorageKey } from "./denaliWizardDraftStorageKeys";
import { denaliDraftHasRestorableContent } from "./denaliWizardDraftRestore";
import {
  getDenaliWizardDraftVersionHash,
  isDenaliWizardDraftVersionCompatible,
} from "./denaliWizardDraftVersion";
import type { DenaliRuleSet } from "./rules/denaliRuleModel";
import { denaliRuleSet } from "./rules/denaliRuleModel";
import { finalizeDenaliWizardHydration } from "./denaliFormHydration";
import { prepareDenaliWizardFormForSubmit } from "./validation/denaliRuleAccess";

/** Suffix for live edits while a legacy primary draft is preserved. */
export const DENALI_WIZARD_DRAFT_BACKUP_SUFFIX = ":backup" as const;

export function resolveDenaliWizardDraftBackupStorageKey(storageKey: string): string {
  const resolvedKey = resolveDenaliDraftStorageKey(storageKey);
  return `${resolvedKey}${DENALI_WIZARD_DRAFT_BACKUP_SUFFIX}`;
}

export type PersistDenaliWizardDraftOptions = {
  /** Workspace template rule set (overlay merged). Normalizes visible/hidden fields before save. */
  ruleSet?: DenaliRuleSet;
};

function prepareDenaliWizardDraftForPersistence(
  formValues: Partial<DenaliCreateTourWizardForm> | DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet,
): DenaliCreateTourWizardForm {
  const normalized = prepareDenaliWizardFormForSubmit(formValues as DenaliCreateTourWizardForm, ruleSet);
  return finalizeDenaliWizardHydration(normalized, ruleSet);
}

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
  /** Workspace template rule set (overlay merged). */
  ruleSet?: DenaliRuleSet;
};

export type DenaliWizardDraftHydrationStatus =
  | { status: "absent" }
  | { status: "compatible"; draft: ParsedDenaliWizardDraft }
  | {
      status: "incompatible";
      draft: ParsedDenaliWizardDraft;
      storedVersionHash?: string;
      currentVersionHash: string;
    };

function hydrateDenaliWizardDraftPatch(
  savedDraft: ParsedDenaliWizardDraft,
  defaults: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet,
): HydratedDenaliWizardDraft {
  const merged = mergeDenaliWizardDefaults(defaults, savedDraft.formPatch, ruleSet);
  const formValues = finalizeDenaliWizardHydration(merged, ruleSet);
  return {
    formValues,
    wizardMeta: savedDraft.wizardMeta,
  };
}

/**
 * Classifies a parsed draft without hydrating — use before deciding banner vs auto-load.
 */
export function resolveDenaliWizardDraftHydration(
  savedDraft: ParsedDenaliWizardDraft | null | undefined,
): DenaliWizardDraftHydrationStatus {
  if (savedDraft?.formPatch == null) {
    return { status: "absent" };
  }

  if (!denaliDraftHasRestorableContent(savedDraft.formPatch)) {
    return { status: "absent" };
  }

  const currentVersionHash = getDenaliWizardDraftVersionHash();
  const storedVersionHash =
    savedDraft.versionHash ?? savedDraft.formStructureVersionHash;

  if (isDenaliWizardDraftVersionCompatible(storedVersionHash, currentVersionHash)) {
    return { status: "compatible", draft: savedDraft };
  }

  return {
    status: "incompatible",
    draft: savedDraft,
    storedVersionHash,
    currentVersionHash,
  };
}

/**
 * Best-effort migration for drafts saved under an older wizard structure hash.
 * Skips the version gate but still merges defaults and runs invariant/rule normalization.
 */
export function tryMigrateDenaliWizardDraft(
  savedDraft: ParsedDenaliWizardDraft | null | undefined,
  defaults: DenaliCreateTourWizardForm,
  options?: Pick<TryHydrateDenaliDraftOptions, "ruleSet">,
): HydratedDenaliWizardDraft | null {
  if (savedDraft?.formPatch == null) {
    return null;
  }
  if (!denaliDraftHasRestorableContent(savedDraft.formPatch)) {
    return null;
  }
  const ruleSet = options?.ruleSet ?? denaliRuleSet;
  return hydrateDenaliWizardDraftPatch(savedDraft, defaults, ruleSet);
}

/**
 * Safe draft hydration: version gate → merge defaults → invariant engine → rule-engine normalize.
 * Returns null when the draft is missing, empty, or structurally incompatible.
 */
export function tryHydrateDraft(
  savedDraft: ParsedDenaliWizardDraft | null | undefined,
  defaults: DenaliCreateTourWizardForm,
  options?: TryHydrateDenaliDraftOptions,
): HydratedDenaliWizardDraft | null {
  const resolution = resolveDenaliWizardDraftHydration(savedDraft);
  if (resolution.status === "absent") {
    return null;
  }

  if (resolution.status === "incompatible") {
    if (options?.throwOnVersionMismatch) {
      throw new DenaliDraftVersionMismatchError(
        "Saved draft versionHash does not match the current wizard structure.",
        resolution.storedVersionHash,
        resolution.currentVersionHash,
      );
    }
    return null;
  }

  const ruleSet = options?.ruleSet ?? denaliRuleSet;
  return hydrateDenaliWizardDraftPatch(resolution.draft, defaults, ruleSet);
}

/** True when a parsed draft can be loaded via {@link tryHydrateDraft}. */
export function isDenaliWizardDraftLoadable(
  savedDraft: ParsedDenaliWizardDraft | null | undefined,
): boolean {
  return resolveDenaliWizardDraftHydration(savedDraft).status === "compatible";
}

function resolveDenaliDraftStorageKey(storageKey: string): string {
  if (isDenaliScopedDraftStorageKey(storageKey)) {
    return storageKey;
  }
  return resolveWizardDraftStorageKeyForBrowserHost(storageKey);
}

export function readDenaliWizardDraftFromStorage(storageKey: string): ParsedDenaliWizardDraft | null {
  if (typeof window === "undefined") {
    return null;
  }
  return readDenaliPrefillFromLocalStorage(resolveDenaliDraftStorageKey(storageKey));
}

/** Reads template-scoped draft, then legacy workspace draft when migrating key strategy. */
export function readDenaliCreateWizardDraftFromStorage(
  templateDraftStorageKey: string,
  legacyWorkspaceDraftStorageKey: string,
): ParsedDenaliWizardDraft | null {
  return (
    readDenaliWizardDraftFromStorage(templateDraftStorageKey) ??
    readDenaliWizardDraftFromStorage(legacyWorkspaceDraftStorageKey)
  );
}

export function persistDenaliWizardDraftToStorage(
  storageKey: string,
  formValues: Partial<DenaliCreateTourWizardForm> | DenaliCreateTourWizardForm,
  wizardMeta: TourWizardDraftMeta | undefined,
  options?: PersistDenaliWizardDraftOptions,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const ruleSet = options?.ruleSet ?? denaliRuleSet;
  const resolvedKey = resolveDenaliDraftStorageKey(storageKey);
  const registrySyncedForm = prepareDenaliWizardDraftForPersistence(formValues, ruleSet);
  localStorage.setItem(resolvedKey, serializeDenaliWizardDraft(registrySyncedForm, wizardMeta));
}

export function persistDenaliWizardDraftBackupToStorage(
  storageKey: string,
  formValues: Partial<DenaliCreateTourWizardForm> | DenaliCreateTourWizardForm,
  wizardMeta: TourWizardDraftMeta | undefined,
  options?: PersistDenaliWizardDraftOptions,
): void {
  if (typeof window === "undefined") {
    return;
  }
  const ruleSet = options?.ruleSet ?? denaliRuleSet;
  const backupKey = resolveDenaliWizardDraftBackupStorageKey(storageKey);
  const registrySyncedForm = prepareDenaliWizardDraftForPersistence(formValues, ruleSet);
  localStorage.setItem(backupKey, serializeDenaliWizardDraft(registrySyncedForm, wizardMeta));
}

export function readDenaliWizardDraftBackupFromStorage(
  storageKey: string,
): ParsedDenaliWizardDraft | null {
  if (typeof window === "undefined") {
    return null;
  }
  const backupKey = resolveDenaliWizardDraftBackupStorageKey(storageKey);
  return readDenaliPrefillFromLocalStorage(backupKey);
}

export function clearDenaliWizardDraftFromStorage(storageKey: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const resolvedKey = resolveDenaliDraftStorageKey(storageKey);
  if (isDenaliScopedDraftStorageKey(resolvedKey)) {
    try {
      window.localStorage.removeItem(resolvedKey);
      window.localStorage.removeItem(resolveDenaliWizardDraftBackupStorageKey(storageKey));
    } catch {
      /* ignore */
    }
    return;
  }
  purgeAllWizardDraftLocalStorageKeys(resolvedKey);
  try {
    window.localStorage.removeItem(resolveDenaliWizardDraftBackupStorageKey(storageKey));
  } catch {
    /* ignore */
  }
}
