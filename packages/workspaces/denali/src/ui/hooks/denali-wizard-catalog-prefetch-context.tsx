"use client";

import { createContext, useContext, type ReactNode } from "react";

export type DenaliWizardCatalogPrefetch = {
  readonly initialLocationsResponse: unknown | null;
  readonly canQuickAddCatalog: boolean;
};

const DenaliWizardCatalogPrefetchContext = createContext<DenaliWizardCatalogPrefetch>({
  initialLocationsResponse: null,
  canQuickAddCatalog: false,
});

export function DenaliWizardCatalogPrefetchProvider({
  children,
  canQuickAddCatalog = false,
  initialLocationsResponse = null,
}: {
  readonly children: ReactNode;
  readonly initialLocationsResponse?: unknown | null;
  readonly canQuickAddCatalog?: boolean;
}) {
  return (
    <DenaliWizardCatalogPrefetchContext.Provider
      value={{ initialLocationsResponse, canQuickAddCatalog }}
    >
      {children}
    </DenaliWizardCatalogPrefetchContext.Provider>
  );
}

export function useDenaliWizardCatalogPrefetch(): DenaliWizardCatalogPrefetch {
  return useContext(DenaliWizardCatalogPrefetchContext);
}
