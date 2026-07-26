"use client";

import { createContext, useContext, type ReactNode } from "react";

export type DenaliWizardCatalogPrefetch = {
  readonly initialLocationsResponse: unknown | null;
};

const DenaliWizardCatalogPrefetchContext = createContext<DenaliWizardCatalogPrefetch>({
  initialLocationsResponse: null,
});

export function DenaliWizardCatalogPrefetchProvider({
  children,
  initialLocationsResponse = null,
}: {
  readonly children: ReactNode;
  readonly initialLocationsResponse?: unknown | null;
}) {
  return (
    <DenaliWizardCatalogPrefetchContext.Provider value={{ initialLocationsResponse }}>
      {children}
    </DenaliWizardCatalogPrefetchContext.Provider>
  );
}

export function useDenaliWizardCatalogPrefetch(): DenaliWizardCatalogPrefetch {
  return useContext(DenaliWizardCatalogPrefetchContext);
}
