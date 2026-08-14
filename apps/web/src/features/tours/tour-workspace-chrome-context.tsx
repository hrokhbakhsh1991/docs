"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  buildWorkspaceTabReplacePath,
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
};

const TourWorkspaceChromeContext = createContext<TourWorkspaceChromeContextValue | null>(
  null
);

type TourWorkspaceChromeProviderProps = {
  readonly tourId: string;
  readonly children: ReactNode;
};

export function TourWorkspaceChromeProvider({
  tourId,
  children,
}: TourWorkspaceChromeProviderProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const workspacePath = workspaceBasePath(tourId);
  const [reloadNonce, setReloadNonce] = useState(0);

  const reloadWorkspaceChrome = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  const navigateWorkspaceTab = useCallback(
    (tab: TourWorkspaceSubnavTab, options?: NavigateWorkspaceTabOptions) => {
      const nextPath = buildWorkspaceTabReplacePath(workspacePath, tab, searchParams, options);
      const currentQs = searchParams.toString();
      const currentPath = currentQs.length > 0 ? `${pathname}?${currentQs}` : pathname;
      if (nextPath === currentPath) {
        return;
      }
      router.replace(nextPath, { scroll: false });
    },
    [pathname, router, searchParams, workspacePath]
  );

  const value = useMemo(
    () => ({ reloadNonce, reloadWorkspaceChrome, navigateWorkspaceTab }),
    [reloadNonce, reloadWorkspaceChrome, navigateWorkspaceTab]
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
    };
  }
  return ctx;
}
