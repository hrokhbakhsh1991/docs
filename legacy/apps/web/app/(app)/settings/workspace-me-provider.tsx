"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import type { MeProfileWire } from "@repo/types";
import { useToast } from "@tour/ui";
import { useTranslations } from "next-intl";

import { pickMeErrorMessage } from "@/lib/me-api-error";

import { fetchMe } from "@/lib/me-client";

/** Payload from `GET /api/v2/me` (proxied as `GET /api/me`). */
export type WorkspaceMeData = MeProfileWire;

export type RefreshWorkspaceMeOptions = {
  /** When true, skip `isLoading` toggles so children do not unmount (e.g. after PATCH). */
  silent?: boolean;
};

export type WorkspaceMeContextValue = {
  data: WorkspaceMeData | null;
  isLoading: boolean;
  error: Error | null;
  refresh: (_opts?: RefreshWorkspaceMeOptions) => Promise<void>;
};

const WorkspaceMeContext = createContext<WorkspaceMeContextValue | null>(null);

export function WorkspaceMeProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const [data, setData] = useState<WorkspaceMeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const toastRef = useRef(showToast);
  const translateRef = useRef(t);
  toastRef.current = showToast;
  translateRef.current = t;

  const refresh = useCallback(async (opts?: RefreshWorkspaceMeOptions) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const res = await fetchMe();
      const body = (await res.json().catch(() => ({}))) as WorkspaceMeData;
      if (!res.ok) {
        setData(null);
        const msg = pickMeErrorMessage(body, translateRef.current("loadFailedToast"), translateRef.current);
        setError(new Error(msg));
        toastRef.current({ type: "error", message: msg });
        return;
      }
      setData(body);
    } catch {
      setData(null);
      setError(new Error(translateRef.current("loadFailedToast")));
      toastRef.current({ type: "error", message: translateRef.current("loadFailedToast") });
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<WorkspaceMeContextValue>(
    () => ({
      data,
      isLoading,
      error,
      refresh
    }),
    [data, isLoading, error, refresh]
  );

  return <WorkspaceMeContext.Provider value={value}>{children}</WorkspaceMeContext.Provider>;
}

export function useWorkspaceMe(): WorkspaceMeContextValue {
  const ctx = useContext(WorkspaceMeContext);
  if (ctx == null) {
    throw new Error("useWorkspaceMe must be used within WorkspaceMeProvider");
  }
  return ctx;
}
