import {
  DENALI_CANONICAL_OBJECT_ROOTS,
  type DenaliWizardDraftEnvelope,
} from "@app-tour/workspace-denali/draft";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

import { isDraftEssentiallyEmpty } from "./denali-wizard-resume-step";

export type NewTourWizardDraftEnvelope = DenaliWizardDraftEnvelope<TourWizardDraft>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyRootValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }
  return true;
}

function mergeRootValue(
  rootKey: string,
  localValue: unknown,
  serverValue: unknown
): unknown {
  if (!DENALI_CANONICAL_OBJECT_ROOTS.has(rootKey)) {
    return localValue;
  }
  if (!isRecord(localValue)) {
    return localValue;
  }
  if (!isRecord(serverValue)) {
    return localValue;
  }
  return { ...serverValue, ...localValue };
}

export function mergeCanonicalFormData(
  localData: Readonly<Record<string, unknown>> | undefined,
  serverData: Readonly<Record<string, unknown>> | undefined,
  deletedRoots: readonly string[] | undefined
): Record<string, unknown> {
  const deleted = new Set(deletedRoots ?? []);
  const local = localData ?? {};
  const server = serverData ?? {};
  const keys = new Set([...Object.keys(server), ...Object.keys(local)]);
  const merged: Record<string, unknown> = {};

  for (const key of keys) {
    if (deleted.has(key)) {
      continue;
    }
    const localValue = local[key];
    const serverValue = server[key];
    const localPresent = key in local;
    const serverPresent = key in server;

    if (localPresent && serverPresent) {
      merged[key] = mergeRootValue(key, localValue, serverValue);
      continue;
    }
    if (localPresent) {
      merged[key] = localValue;
      continue;
    }
    if (serverPresent) {
      merged[key] = serverValue;
    }
  }

  return merged;
}

export function trackDeletedCanonicalRoots(
  previousData: Readonly<Record<string, unknown>> | undefined,
  nextData: Readonly<Record<string, unknown>> | undefined,
  existingDeletedRoots?: readonly string[]
): readonly string[] | undefined {
  const previous = previousData ?? {};
  const next = nextData ?? {};
  const tombstones = new Set(existingDeletedRoots ?? []);

  for (const rootKey of DENALI_CANONICAL_OBJECT_ROOTS) {
    if (rootKey in previous && isNonEmptyRootValue(previous[rootKey]) && !(rootKey in next)) {
      tombstones.add(rootKey);
    }
  }

  if (tombstones.size === 0) {
    return existingDeletedRoots !== undefined && existingDeletedRoots.length > 0
      ? existingDeletedRoots
      : undefined;
  }
  return [...tombstones].sort();
}

function isFreshStartEnvelope(envelope: NewTourWizardDraftEnvelope): boolean {
  return envelope.meta.freshStart === true;
}

/** True when local envelope is an explicit post-clear fresh start (OCC bypass). */
export function isDenaliFreshStartEnvelope(envelope: NewTourWizardDraftEnvelope): boolean {
  return isFreshStartEnvelope(envelope);
}

export function mergeDenaliWizardDraftEnvelope(
  local: NewTourWizardDraftEnvelope,
  server: NewTourWizardDraftEnvelope
): NewTourWizardDraftEnvelope {
  if (isFreshStartEnvelope(local)) {
    return {
      form: structuredClone(local.form),
      meta: {
        currentStepIndex: local.meta.currentStepIndex,
        ...(local.meta.wizardSessionId !== undefined
          ? { wizardSessionId: local.meta.wizardSessionId }
          : {}),
        freshStart: true,
      },
    };
  }

  const deletedRoots =
    server.meta.deletedRoots !== undefined && server.meta.deletedRoots.length > 0
      ? server.meta.deletedRoots
      : undefined;
  const localData = local.form.data as Record<string, unknown> | undefined;
  const serverData = server.form.data as Record<string, unknown> | undefined;
  const localEssentiallyEmpty = isDraftEssentiallyEmpty(local.form as Record<string, unknown>);

  return {
    form: {
      data: mergeCanonicalFormData(localData, serverData, deletedRoots) as TourWizardDraft["data"],
    },
    meta: {
      currentStepIndex: (() => {
        if (local.meta.freshStart === true) {
          return 0;
        }
        if (local.meta.currentStepIndex > 0) {
          return local.meta.currentStepIndex;
        }
        if (localEssentiallyEmpty) {
          return 0;
        }
        return server.meta.currentStepIndex;
      })(),
      wizardSessionId: local.meta.wizardSessionId ?? server.meta.wizardSessionId,
    },
  };
}
