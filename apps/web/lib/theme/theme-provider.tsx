"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  applyThemeClass,
  readStoredThemePreference,
  readSystemThemePreference,
  resolveThemeMode,
  writeStoredThemePreference,
  type ThemeMode,
} from "./theme-preference";

export type { ThemeMode } from "./theme-preference";
export { THEME_STORAGE_KEY } from "./theme-preference";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Standalone theme scope — no auth/session dependency.
 * Initializes from localStorage + system preference before paint via `useLayoutEffect`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");

  useLayoutEffect(() => {
    const resolved = resolveThemeMode();
    setThemeState(resolved);
    applyThemeClass(resolved);

    const win = typeof window !== "undefined" ? window : undefined;
    const media =
      win && typeof win.matchMedia === "function"
        ? win.matchMedia("(prefers-color-scheme: dark)")
        : null;
    if (!media) {
      return undefined;
    }

    const onSystemChange = () => {
      if (readStoredThemePreference() !== null) {
        return;
      }
      const next = readSystemThemePreference();
      setThemeState(next);
      applyThemeClass(next);
    };

    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    applyThemeClass(next);
    try {
      writeStoredThemePreference(next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === "light" ? "dark" : "light";
      applyThemeClass(next);
      try {
        writeStoredThemePreference(next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
