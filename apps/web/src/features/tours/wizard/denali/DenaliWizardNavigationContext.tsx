"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";

import {
  clearDenaliWizardFieldFocus,
  focusDenaliWizardField,
} from "./denaliWizardFieldFocus";

type DenaliWizardNavigationContextValue = {
  currentStepIndex: number;
  pendingFocusPath: string | null;
  navigateToField: (_stepId: DenaliCreateWizardStepId, _formPath: string) => void;
  consumePendingFocus: (_activeStepId: DenaliCreateWizardStepId) => void;
  clearPendingFocus: () => void;
};

const DenaliWizardNavigationContext = createContext<DenaliWizardNavigationContextValue | null>(
  null,
);

export function DenaliWizardNavigationProvider({
  visibleSteps,
  currentStepIndex,
  setCurrentStep,
  children,
}: {
  visibleSteps: readonly DenaliCreateWizardStepId[];
  currentStepIndex: number;
  setCurrentStep: (_updater: (_prev: number) => number) => void;
  children: ReactNode;
}) {
  const [pendingFocusPath, setPendingFocusPath] = useState<string | null>(null);
  const [pendingStepId, setPendingStepId] = useState<DenaliCreateWizardStepId | null>(null);

  const navigateToField = useCallback(
    (stepId: DenaliCreateWizardStepId, formPath: string) => {
      const stepIndex = visibleSteps.indexOf(stepId);
      if (stepIndex < 0) return;
      setPendingFocusPath(formPath);
      setPendingStepId(stepId);
      if (stepIndex !== currentStepIndex) {
        setCurrentStep(() => stepIndex);
      } else {
        window.requestAnimationFrame(() => {
          focusDenaliWizardField(formPath);
        });
      }
      window.scrollTo(0, 0);
    },
    [currentStepIndex, setCurrentStep, visibleSteps],
  );

  const consumePendingFocus = useCallback(
    (activeStepId: DenaliCreateWizardStepId) => {
      if (pendingFocusPath == null || pendingStepId !== activeStepId) return;
      const path = pendingFocusPath;
      setPendingFocusPath(null);
      setPendingStepId(null);
      window.requestAnimationFrame(() => {
        window.setTimeout(() => focusDenaliWizardField(path), 50);
      });
    },
    [pendingFocusPath, pendingStepId],
  );

  const clearPendingFocus = useCallback(() => {
    setPendingFocusPath(null);
    setPendingStepId(null);
    clearDenaliWizardFieldFocus();
  }, []);

  const value = useMemo(
    () => ({
      currentStepIndex,
      pendingFocusPath,
      navigateToField,
      consumePendingFocus,
      clearPendingFocus,
    }),
    [clearPendingFocus, consumePendingFocus, currentStepIndex, navigateToField, pendingFocusPath],
  );

  return (
    <DenaliWizardNavigationContext.Provider value={value}>
      {children}
    </DenaliWizardNavigationContext.Provider>
  );
}

export function useDenaliWizardNavigation(): DenaliWizardNavigationContextValue {
  const ctx = useContext(DenaliWizardNavigationContext);
  if (ctx == null) {
    throw new Error("useDenaliWizardNavigation must be used within DenaliWizardNavigationProvider");
  }
  return ctx;
}

export function useDenaliWizardNavigationOptional() {
  return useContext(DenaliWizardNavigationContext);
}
