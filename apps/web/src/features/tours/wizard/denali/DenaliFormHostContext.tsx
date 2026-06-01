"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export type DenaliFormHostMode = "wizard-create" | "tour-edit" | "template-settings";

export type DenaliFormHostCapabilities = {
  readonly enablePhotoUpload: boolean;
  readonly enableQuickAdd: boolean;
};

export type DenaliFormHostContextValue = {
  readonly mode: DenaliFormHostMode;
  readonly capabilities: DenaliFormHostCapabilities;
};

export const DENALI_WIZARD_CREATE_HOST_CAPABILITIES: DenaliFormHostCapabilities = {
  enablePhotoUpload: true,
  enableQuickAdd: true,
};

export const DENALI_TEMPLATE_SETTINGS_HOST_CAPABILITIES: DenaliFormHostCapabilities = {
  enablePhotoUpload: false,
  enableQuickAdd: true,
};

const DenaliFormHostContext = createContext<DenaliFormHostContextValue | null>(null);

export function DenaliFormHostProvider({
  mode,
  capabilities,
  children,
}: {
  mode: DenaliFormHostMode;
  capabilities: DenaliFormHostCapabilities;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      mode,
      capabilities,
    }),
    [capabilities, mode],
  );

  return <DenaliFormHostContext.Provider value={value}>{children}</DenaliFormHostContext.Provider>;
}

export function useDenaliFormHost(): DenaliFormHostContextValue {
  const ctx = useContext(DenaliFormHostContext);
  if (ctx == null) {
    throw new Error("useDenaliFormHost must be used within DenaliFormHostProvider");
  }
  return ctx;
}

export function useDenaliFormHostOptional(): DenaliFormHostContextValue | null {
  return useContext(DenaliFormHostContext);
}
