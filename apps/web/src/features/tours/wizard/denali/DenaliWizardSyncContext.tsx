"use client";

import { createContext, useContext, type ReactNode } from "react";

export type DenaliWizardSyncContextValue = {
  /** True while debounced/in-flight tour wizard draft PATCH is active (server sync rail only). */
  readonly isSyncing: boolean;
};

const DenaliWizardSyncContext = createContext<DenaliWizardSyncContextValue>({
  isSyncing: false,
});

export function DenaliWizardSyncProvider({
  isSyncing,
  children,
}: {
  isSyncing: boolean;
  children: ReactNode;
}) {
  return (
    <DenaliWizardSyncContext.Provider value={{ isSyncing }}>{children}</DenaliWizardSyncContext.Provider>
  );
}

export function useDenaliWizardSync(): DenaliWizardSyncContextValue {
  return useContext(DenaliWizardSyncContext);
}
