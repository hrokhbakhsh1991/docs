"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import {
  fetchTourWizardDraft,
  patchTourWizardDraft,
  TOUR_WIZARD_DRAFT_INITIAL_VERSION,
  TourWizardDraftStaleError,
} from "@/lib/tour-wizard-draft.client";
import { serializeDenaliWizardDraft } from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";

import { canAutoRetryTourWizardDraftSelfConflict } from "./tourWizardDraftSyncSelfHeal";

const DEBOUNCE_MS = 500;
const SETTLED_UI_MS = 2000;

export type UseTourWizardServerSyncOptions = {
  workspaceId: string | null;
  form: UseFormReturn<DenaliCreateTourWizardForm>;
  currentStepIndex: number;
  wizardMetaRef: MutableRefObject<TourWizardDraftMeta | undefined>;
  /** When false, debounced PATCH is suppressed (e.g. during server hydrate). */
  enabled: boolean;
  /** Optimistic-lock token from GET hydrate; bumped after each successful PATCH. */
  draftVersionRef: MutableRefObject<number>;
};

export type UseTourWizardServerSyncResult = {
  isSyncing: boolean;
  syncSettled: boolean;
  syncConflict: boolean;
  syncConflictMessage: string | null;
  syncNow: () => void;
  clearSyncConflict: () => void;
  noteDraftVersion: (version: number | null | undefined) => void;
  /** After server hydrate, mark current form snapshot as already synced (avoids immediate stale PATCH). */
  seedLastSyncedFingerprint: () => void;
};

export function useTourWizardServerSync({
  workspaceId,
  form,
  currentStepIndex,
  wizardMetaRef,
  enabled,
  draftVersionRef,
}: UseTourWizardServerSyncOptions): UseTourWizardServerSyncResult {
  const [inFlight, setInFlight] = useState(false);
  const [debouncePending, setDebouncePending] = useState(false);
  const [syncSettled, setSyncSettled] = useState(false);
  const [syncConflict, setSyncConflict] = useState(false);
  const [syncConflictMessage, setSyncConflictMessage] = useState<string | null>(null);

  const lastSyncedPayloadRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightChainRef = useRef<Promise<void> | null>(null);
  const prevStepIndexRef = useRef(currentStepIndex);
  const syncConflictRef = useRef(false);

  const watched = useWatch({ control: form.control });

  useEffect(() => {
    syncConflictRef.current = syncConflict;
  }, [syncConflict]);

  const noteDraftVersion = useCallback(
    (version: number | null | undefined) => {
      draftVersionRef.current =
        typeof version === "number" && Number.isInteger(version) && version >= 1
          ? version
          : TOUR_WIZARD_DRAFT_INITIAL_VERSION;
    },
    [draftVersionRef],
  );

  const clearSyncConflict = useCallback(() => {
    setSyncConflict(false);
    setSyncConflictMessage(null);
  }, []);

  const buildPayload = useCallback((): Record<string, unknown> | null => {
    try {
      const serialized = serializeDenaliWizardDraft(form.getValues(), wizardMetaRef.current);
      return JSON.parse(serialized) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [form, wizardMetaRef]);

  const buildFingerprint = useCallback((): string | null => {
    const payload = buildPayload();
    if (!payload) {
      return null;
    }
    return JSON.stringify({ currentStepIndex, payload });
  }, [buildPayload, currentStepIndex]);

  const seedLastSyncedFingerprint = useCallback(() => {
    const fingerprint = buildFingerprint();
    if (fingerprint) {
      lastSyncedPayloadRef.current = fingerprint;
    }
  }, [buildFingerprint]);

  const runPatch = useCallback(async () => {
    const ws = workspaceId?.trim();
    if (!ws || !enabled || syncConflictRef.current) {
      return;
    }
    const payload = buildPayload();
    if (!payload) {
      return;
    }
    const fingerprint = JSON.stringify({ currentStepIndex, payload });
    if (fingerprint === lastSyncedPayloadRef.current) {
      return;
    }

    const execute = async (): Promise<void> => {
      setInFlight(true);
      setSyncSettled(false);
      if (settledTimerRef.current) {
        clearTimeout(settledTimerRef.current);
        settledTimerRef.current = null;
      }
      const attemptedVersion = draftVersionRef.current;

      try {
        const result = await patchTourWizardDraft(ws, {
          currentStepIndex,
          payload,
          version: attemptedVersion,
        });
        noteDraftVersion(result.version);
        lastSyncedPayloadRef.current = fingerprint;
        clearSyncConflict();
        setSyncSettled(true);
        settledTimerRef.current = setTimeout(() => {
          setSyncSettled(false);
          settledTimerRef.current = null;
        }, SETTLED_UI_MS);
      } catch (error: unknown) {
        if (error instanceof TourWizardDraftStaleError) {
          try {
            const { draft } = await fetchTourWizardDraft(ws);

            if (
              canAutoRetryTourWizardDraftSelfConflict(attemptedVersion, draft, {
                currentStepIndex,
                payload,
              })
            ) {
              const serverVersion = draft!.version;
              noteDraftVersion(serverVersion);
              const retryResult = await patchTourWizardDraft(ws, {
                currentStepIndex,
                payload,
                version: serverVersion,
              });
              noteDraftVersion(retryResult.version);
              lastSyncedPayloadRef.current = fingerprint;
              clearSyncConflict();
              setSyncSettled(true);
              settledTimerRef.current = setTimeout(() => {
                setSyncSettled(false);
                settledTimerRef.current = null;
              }, SETTLED_UI_MS);
              return;
            }

            noteDraftVersion(draft?.version);
          } catch {
            /* keep local version ref if refresh fails */
          }
          setSyncConflict(true);
          setSyncConflictMessage(error.message);
          return;
        }
        /* server unavailable — UI stays idle */
      } finally {
        setInFlight(false);
        inFlightChainRef.current = null;
      }
    };

    if (inFlightChainRef.current) {
      inFlightChainRef.current = inFlightChainRef.current.then(execute);
      return;
    }
    inFlightChainRef.current = execute();
  }, [
    buildPayload,
    clearSyncConflict,
    currentStepIndex,
    draftVersionRef,
    enabled,
    noteDraftVersion,
    workspaceId,
  ]);

  const syncNow = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      setDebouncePending(false);
    }
    void runPatch();
  }, [runPatch]);

  useEffect(() => {
    if (!enabled || !workspaceId?.trim() || syncConflictRef.current) {
      return;
    }
    setDebouncePending(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      setDebouncePending(false);
      if (syncConflictRef.current) {
        return;
      }
      void runPatch();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [watched, enabled, workspaceId, runPatch]);

  useEffect(() => {
    if (!enabled || !workspaceId?.trim() || syncConflictRef.current) {
      return;
    }
    if (prevStepIndexRef.current === currentStepIndex) {
      return;
    }
    prevStepIndexRef.current = currentStepIndex;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      setDebouncePending(false);
    }
    void runPatch();
  }, [currentStepIndex, enabled, workspaceId, runPatch]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (settledTimerRef.current) {
        clearTimeout(settledTimerRef.current);
      }
    };
  }, []);

  const isSyncing = inFlight || debouncePending;

  return {
    isSyncing,
    syncSettled,
    syncConflict,
    syncConflictMessage,
    syncNow,
    clearSyncConflict,
    noteDraftVersion,
    seedLastSyncedFingerprint,
  };
}
