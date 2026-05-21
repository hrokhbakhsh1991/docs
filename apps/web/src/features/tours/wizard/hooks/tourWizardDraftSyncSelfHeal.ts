import type { TourWizardDraftRecord } from "@/lib/tour-wizard-draft.client";

export function tourWizardDraftStructuralFingerprint(
  currentStepIndex: number,
  payload: Record<string, unknown>,
): string {
  return JSON.stringify({ currentStepIndex, payload });
}

export function isTourWizardDraftOneVersionAhead(
  attemptedVersion: number,
  serverVersion: number | undefined | null,
): boolean {
  return (
    typeof serverVersion === "number" &&
    Number.isInteger(serverVersion) &&
    serverVersion === attemptedVersion + 1
  );
}

export function isTourWizardDraftStructurallyAligned(
  local: { currentStepIndex: number; payload: Record<string, unknown> },
  server: { currentStepIndex: number; payload: Record<string, unknown> },
): boolean {
  return (
    tourWizardDraftStructuralFingerprint(local.currentStepIndex, local.payload) ===
    tourWizardDraftStructuralFingerprint(server.currentStepIndex, server.payload)
  );
}

/**
 * True when a 409 likely came from the same client lagging one OCC generation behind,
 * not from another device mutating draft content.
 */
export function canAutoRetryTourWizardDraftSelfConflict(
  attemptedVersion: number,
  serverDraft: TourWizardDraftRecord | null | undefined,
  local: { currentStepIndex: number; payload: Record<string, unknown> },
): boolean {
  if (!serverDraft?.payload || typeof serverDraft.payload !== "object") {
    return false;
  }
  if (!isTourWizardDraftOneVersionAhead(attemptedVersion, serverDraft.version)) {
    return false;
  }
  return isTourWizardDraftStructurallyAligned(local, {
    currentStepIndex: serverDraft.currentStepIndex ?? 0,
    payload: serverDraft.payload as Record<string, unknown>,
  });
}
