import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";

/** Persisted / remote Denali create-wizard draft payload (multi-device sync). */
export type DenaliDraftSyncPayload = {
  form: DenaliCreateTourWizardForm;
  currentStepIndex: number;
  railLayoutVersion: number;
  registryLayoutVersion: number;
};

export type DenaliDraftHydrateStatus = "ok" | "migrated" | "discarded";

export type DenaliDraftHydrateResult = {
  status: DenaliDraftHydrateStatus;
  snapshot: DenaliDraftSyncPayload;
  warnings: string[];
};

export type DenaliDraftSyncWarningHandler = (message: string) => void;
