"use client";

import { createContext, useContext, type ReactNode } from "react";

export type DenaliDraftRecoveryContextValue = {
  /** True when a server or local draft can be restored via user action. */
  readonly hasRecoverableDraft: boolean;
  /** Applies the pending server draft, or local draft when no server draft is pending. */
  readonly recoverDraft: () => void;
};

const DenaliDraftRecoveryContext = createContext<DenaliDraftRecoveryContextValue | null>(null);

export function DenaliDraftRecoveryProvider({
  hasRecoverableDraft,
  recoverDraft,
  children,
}: DenaliDraftRecoveryContextValue & { children: ReactNode }) {
  return (
    <DenaliDraftRecoveryContext.Provider value={{ hasRecoverableDraft, recoverDraft }}>
      {children}
    </DenaliDraftRecoveryContext.Provider>
  );
}

export function useDenaliDraftRecovery(): DenaliDraftRecoveryContextValue {
  const ctx = useContext(DenaliDraftRecoveryContext);
  if (ctx == null) {
    return {
      hasRecoverableDraft: false,
      recoverDraft: () => {},
    };
  }
  return ctx;
}
