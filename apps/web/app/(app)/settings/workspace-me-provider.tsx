"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { useToast } from "@tour/ui";
import { useTranslations } from "next-intl";

/** Payload from `GET /api/v2/me` (proxied as `GET /api/me`). */
export type WorkspaceMeData = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  is_email_verified?: boolean;
  phone?: string | null;
  is_phone_verified?: boolean;
  notifications_enabled?: boolean;
};

export function pickMeErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const err = (payload as { error?: { message?: string } }).error;
    if (typeof err?.message === "string" && err.message.trim() !== "") {
      return err.message.trim();
    }
  }
  return fallback;
}

export type RefreshWorkspaceMeOptions = {
  /** When true, skip `isLoading` toggles so children do not unmount (e.g. after PATCH). */
  silent?: boolean;
};

export type WorkspaceMeContextValue = {
  data: WorkspaceMeData | null;
  isLoading: boolean;
  error: Error | null;
  refresh: (opts?: RefreshWorkspaceMeOptions) => Promise<void>;
};

const WorkspaceMeContext = createContext<WorkspaceMeContextValue | null>(null);

export function WorkspaceMeProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const [data, setData] = useState<WorkspaceMeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(
    async (opts?: RefreshWorkspaceMeOptions) => {
      const silent = opts?.silent === true;
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);
      try {
        const res = await fetch("/api/me", { credentials: "include", cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as WorkspaceMeData;
        if (!res.ok) {
          setData(null);
          const msg = pickMeErrorMessage(body, t("loadFailedToast"));
          setError(new Error(msg));
          showToast({ type: "error", message: msg });
          return;
        }
        setData(body);
      } catch {
        setData(null);
        setError(new Error(t("loadFailedToast")));
        showToast({ type: "error", message: t("loadFailedToast") });
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [showToast, t],
  );

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
