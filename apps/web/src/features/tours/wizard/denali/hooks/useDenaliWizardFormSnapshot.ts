"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { useDenaliWizardNavigationOptional } from "../DenaliWizardNavigationContext";

const DEFAULT_SNAPSHOT_DEBOUNCE_MS = 500;

export type UseDenaliWizardFormSnapshotOptions = {
  /** Debounce field-driven snapshot updates. `0` = immediate (review/submit). Default 500 (header). */
  debounceMs?: number;
};

/**
 * Denali wizard form values for progress UI, review summaries, and submit guards.
 *
 * Field edits subscribe via RHF `watch` (no per-keystroke re-render unless `debounceMs` is 0).
 * Wizard step index changes always refresh immediately.
 */
export function useDenaliWizardFormSnapshot(
  options?: UseDenaliWizardFormSnapshotOptions,
): DenaliCreateTourWizardForm {
  const debounceMs = options?.debounceMs ?? DEFAULT_SNAPSHOT_DEBOUNCE_MS;
  const immediate = debounceMs === 0;

  const { watch, getValues } = useFormContext<DenaliCreateTourWizardForm>();
  const navigation = useDenaliWizardNavigationOptional();
  const currentStepIndex = navigation?.currentStepIndex;

  const [snapshot, setSnapshot] = useState<DenaliCreateTourWizardForm>(() => getValues());
  const getValuesRef = useRef(getValues);
  getValuesRef.current = getValues;

  const refreshSnapshot = useCallback(() => {
    setSnapshot(getValuesRef.current());
  }, []);

  useEffect(() => {
    refreshSnapshot();
  }, [currentStepIndex, refreshSnapshot]);

  useEffect(() => {
    if (immediate) {
      const subscription = watch(() => {
        setSnapshot(getValuesRef.current());
      });
      return () => subscription.unsubscribe();
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const subscription = watch(() => {
      if (debounceTimer != null) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        setSnapshot(getValuesRef.current());
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      if (debounceTimer != null) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceMs, immediate, watch]);

  return snapshot;
}
