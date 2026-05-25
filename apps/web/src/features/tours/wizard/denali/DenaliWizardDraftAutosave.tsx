"use client";

import { useEffect, type MutableRefObject } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";

import type { DenaliRuleSet } from "./rules/denaliRuleModel";
import {
  persistDenaliWizardDraftBackupToStorage,
  persistDenaliWizardDraftToStorage,
} from "./safeDraftHydration";

export function DenaliWizardDraftAutosave({
  enabled,
  draftStorageKey,
  formMethods,
  draftWizardMetaRef,
  ruleSet,
  canonicalSyncToken,
  useBackupStorage,
}: {
  enabled: boolean;
  draftStorageKey: string;
  formMethods: UseFormReturn<DenaliCreateTourWizardForm>;
  draftWizardMetaRef: MutableRefObject<TourWizardDraftMeta | undefined>;
  ruleSet: DenaliRuleSet;
  canonicalSyncToken: number;
  useBackupStorage: boolean;
}) {
  const formSnapshot = useWatch({
    control: formMethods.control,
    defaultValue: formMethods.getValues(),
  });
  const transportSnapshot = useWatch({
    control: formMethods.control,
    name: "transport",
  });
  const logisticsSnapshot = useWatch({
    control: formMethods.control,
    name: "tripDetails.logistics",
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      try {
        const values = formMethods.getValues();
        const persistOptions = { ruleSet };
        if (useBackupStorage) {
          persistDenaliWizardDraftBackupToStorage(
            draftStorageKey,
            values,
            draftWizardMetaRef.current,
            persistOptions,
          );
          return;
        }
        persistDenaliWizardDraftToStorage(
          draftStorageKey,
          values,
          draftWizardMetaRef.current,
          persistOptions,
        );
      } catch {
        /* ignore */
      }
    }, 600);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    canonicalSyncToken,
    draftStorageKey,
    draftWizardMetaRef,
    enabled,
    formMethods,
    formSnapshot,
    logisticsSnapshot,
    ruleSet,
    transportSnapshot,
    useBackupStorage,
  ]);

  return null;
}
