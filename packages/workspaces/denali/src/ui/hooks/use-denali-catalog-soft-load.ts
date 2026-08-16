"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function catalogLoadErrorMessage(error: unknown, fallbackCode: string): string {
  return error instanceof Error ? error.message : fallbackCode;
}

/**
 * ED-CAT-RETRY-01 — mount fetch + explicit reload + focus/visibility retry while degraded.
 * Each attempt still uses `fetchDenaliCatalogJsonWithSoftRetry` (one 5xx/network retry).
 */
export function useDenaliCatalogSoftLoad<T>(
  load: () => Promise<T>,
  fallbackErrorCode: string
): {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => {
    setLoading(true);
    void loadRef
      .current()
      .then((next) => {
        setData(next);
        setError(null);
      })
      .catch((caught: unknown) => {
        setError(catalogLoadErrorMessage(caught, fallbackErrorCode));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fallbackErrorCode]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (error === null) {
      return;
    }
    const retryWhenVisible = () => {
      if (document.visibilityState === "visible") {
        reload();
      }
    };
    document.addEventListener("visibilitychange", retryWhenVisible);
    window.addEventListener("focus", retryWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", retryWhenVisible);
      window.removeEventListener("focus", retryWhenVisible);
    };
  }, [error, reload]);

  return { data, loading, error, reload };
}
