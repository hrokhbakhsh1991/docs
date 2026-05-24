export const QUICK_ADD_WIZARD_GUARD_SESSION_KEY = "tour-wizard-quick-add-guard-v1";

export type QuickAddWizardGuardPayload = {
  storageKey: string;
  serializedDraft: string;
  savedAt: string;
};

export function persistWizardSnapshotForQuickAdd(input: {
  storageKey: string;
  serializedDraft: string;
}): void {
  if (typeof window === "undefined") {
    return;
  }
  const guard: QuickAddWizardGuardPayload = {
    storageKey: input.storageKey,
    serializedDraft: input.serializedDraft,
    savedAt: new Date().toISOString(),
  };
  try {
    window.sessionStorage.setItem(QUICK_ADD_WIZARD_GUARD_SESSION_KEY, JSON.stringify(guard));
  } catch {
    /* private mode / quota */
  }
  try {
    window.localStorage.setItem(input.storageKey, input.serializedDraft);
  } catch {
    /* ignore */
  }
}

export function readWizardQuickAddGuard(): QuickAddWizardGuardPayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(QUICK_ADD_WIZARD_GUARD_SESSION_KEY);
    if (!raw?.trim()) {
      return null;
    }
    const parsed = JSON.parse(raw) as QuickAddWizardGuardPayload;
    if (
      typeof parsed.storageKey !== "string" ||
      typeof parsed.serializedDraft !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearWizardQuickAddGuard(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(QUICK_ADD_WIZARD_GUARD_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Restores localStorage draft from the session guard (safety net after modal close). */
export function restoreWizardDraftFromQuickAddGuard(): boolean {
  const guard = readWizardQuickAddGuard();
  if (!guard || typeof window === "undefined") {
    return false;
  }
  try {
    window.localStorage.setItem(guard.storageKey, guard.serializedDraft);
    return true;
  } catch {
    return false;
  }
}
