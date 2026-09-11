"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  buildWorkspaceTabReplacePath,
  resolveWorkspaceSubnavTab,
  workspaceBasePath,
} from "@/features/tours/tour-workspace-logic";
import type { TourWorkspaceSubnavTab } from "@/features/tours/tour-workspace-types";

export type NavigateWorkspaceTabOptions = {
  readonly focusRegistrationId?: string | null;
};

type TourWorkspaceChromeContextValue = {
  readonly reloadNonce: number;
  readonly reloadWorkspaceChrome: () => void;
  /** In-workspace tab switch — null outside workspace shell (use href deep links). */
  readonly navigateWorkspaceTab:
    | ((tab: TourWorkspaceSubnavTab, options?: NavigateWorkspaceTabOptions) => void)
    | null;
  /** Immediate client state for keep-alive panels; URL remains the shareable source. */
  readonly activeTab: TourWorkspaceSubnavTab;
};

const TourWorkspaceChromeContext = createContext<TourWorkspaceChromeContextValue | null>(null);

type TourWorkspaceChromeProviderProps = {
  readonly tourId: string;
  readonly children: ReactNode;
};

export function TourWorkspaceChromeProvider({
  tourId,
  children,
}: TourWorkspaceChromeProviderProps) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const workspacePath = workspaceBasePath(tourId);
  const [reloadNonce, setReloadNonce] = useState(0);
  const resolvedTab = resolveWorkspaceSubnavTab(pathname, tourId, searchParams?.get("tab"));
  const [activeTab, setActiveTab] = useState<TourWorkspaceSubnavTab>(resolvedTab);

  // Keep deep-links, back/forward, and external URL changes authoritative.
  useEffect(() => {
    setActiveTab(resolvedTab);
  }, [resolvedTab]);

  const reloadWorkspaceChrome = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  const navigateWorkspaceTab = useCallback(
    (tab: TourWorkspaceSubnavTab, options?: NavigateWorkspaceTabOptions) => {
      const nextPath = buildWorkspaceTabReplacePath(
        workspacePath,
        tab,
        searchParams?.toString(),
        options
      );
      const currentQs = searchParams?.toString() ?? "";
      const currentPath = currentQs.length > 0 ? `${pathname}?${currentQs}` : pathname;
      if (nextPath === currentPath) {
        return;
      }
      setActiveTab(tab);
      // Workspace tabs are keep-alive client panels. Keep the immediate panel state local while
      // preserving the URL as a shareable deep-link without triggering an RSC navigation.
      window.history.replaceState(window.history.state, "", nextPath);
    },
    [pathname, searchParams, workspacePath]
  );

  const value = useMemo(
    () => ({ reloadNonce, reloadWorkspaceChrome, navigateWorkspaceTab, activeTab }),
    [activeTab, reloadNonce, reloadWorkspaceChrome, navigateWorkspaceTab]
  );

  return (
    <TourWorkspaceChromeContext.Provider value={value}>
      {children}
    </TourWorkspaceChromeContext.Provider>
  );
}

export function useTourWorkspaceChrome(): TourWorkspaceChromeContextValue {
  const ctx = useContext(TourWorkspaceChromeContext);
  if (ctx === null) {
    return {
      reloadNonce: 0,
      reloadWorkspaceChrome: () => undefined,
      navigateWorkspaceTab: null,
      activeTab: "registrations",
    };
  }
  return ctx;
}
