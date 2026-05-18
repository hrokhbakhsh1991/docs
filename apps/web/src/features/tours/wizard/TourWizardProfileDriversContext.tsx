"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ThemeRowForProfile } from "./tourWizardProfileResolve";

export type WizardProfileDriverHint = {
  mainTourThemeId?: string;
  themeCatalog?: ThemeRowForProfile[];
};

export type NotifyWizardProfileDrivers = (hint?: WizardProfileDriverHint) => void;

export type SyncTourWizardProfileDrivers = (
  hint?: WizardProfileDriverHint,
) => void;

const TourWizardProfileDriversContext = createContext<NotifyWizardProfileDrivers | null>(null);

export function TourWizardProfileDriversProvider({
  notifyProfileDriversChanged,
  children,
}: {
  notifyProfileDriversChanged: NotifyWizardProfileDrivers;
  children: ReactNode;
}) {
  return (
    <TourWizardProfileDriversContext.Provider value={notifyProfileDriversChanged}>
      {children}
    </TourWizardProfileDriversContext.Provider>
  );
}

/** Called from steps when tour type / main theme changes so profile resolves from live RHF values. */
export function useNotifyWizardProfileDrivers(): NotifyWizardProfileDrivers | null {
  return useContext(TourWizardProfileDriversContext);
}
