"use client";

import { createContext, useContext, type ReactNode } from "react";

type WizardStepNavigationContextValue = {
  readonly goToStepId: (stepId: string) => void;
};

const WizardStepNavigationContext = createContext<WizardStepNavigationContextValue | null>(null);

export function WizardStepNavigationProvider({
  children,
  goToStepId,
}: {
  readonly children: ReactNode;
  readonly goToStepId: (stepId: string) => void;
}) {
  return (
    <WizardStepNavigationContext.Provider value={{ goToStepId }}>
      {children}
    </WizardStepNavigationContext.Provider>
  );
}

export function useWizardStepNavigation(): WizardStepNavigationContextValue | null {
  return useContext(WizardStepNavigationContext);
}
