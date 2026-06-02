"use client";

import { createContext, useContext, type ReactNode } from "react";

export type DenaliSectionContextValue = {
  tourId?: string;
};

const DenaliSectionContext = createContext<DenaliSectionContextValue>({});

export function DenaliSectionProvider({
  tourId,
  children,
}: DenaliSectionContextValue & { children: ReactNode }) {
  return (
    <DenaliSectionContext.Provider value={{ tourId }}>{children}</DenaliSectionContext.Provider>
  );
}

export function useDenaliSectionContext(): DenaliSectionContextValue {
  return useContext(DenaliSectionContext);
}
