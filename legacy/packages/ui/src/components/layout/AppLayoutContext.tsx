"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppLayoutChromeState = {
  title?: string;
  /** Short subtitle under the title (maps to `PageHeader` description). */
  description?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
};

type AppLayoutContextValue = {
  chrome: AppLayoutChromeState;
  setChrome: (next: AppLayoutChromeState | null) => void;
};

const AppLayoutContext = createContext<AppLayoutContextValue | null>(null);

export function AppLayoutProvider({ children }: { children: ReactNode }) {
  const [chrome, setChromeState] = useState<AppLayoutChromeState>({});

  const setChrome = useCallback((next: AppLayoutChromeState | null) => {
    setChromeState(next ?? {});
  }, []);

  const value = useMemo(() => ({ chrome, setChrome }), [chrome, setChrome]);

  return <AppLayoutContext.Provider value={value}>{children}</AppLayoutContext.Provider>;
}

/** Update app chrome from route-level client components; clears on `null`. */
export function useAppLayoutChromeSetter() {
  const ctx = useContext(AppLayoutContext);
  if (!ctx) {
    throw new Error("useAppLayoutChromeSetter must be used within AppLayoutProvider.");
  }
  return ctx.setChrome;
}

export function useOptionalAppLayoutChrome(): AppLayoutContextValue | null {
  return useContext(AppLayoutContext);
}
