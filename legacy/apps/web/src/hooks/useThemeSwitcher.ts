"use client";

import { useTheme, type ThemeMode } from "@/lib/theme/theme-provider";

export type { ThemeMode };

/**
 * @deprecated Prefer `useTheme` from `@/lib/theme/theme-provider`.
 * Kept for AppLayout / ui-playground call sites.
 */
export function useThemeSwitcher(_defaultTheme: ThemeMode = "light") {
  return useTheme();
}
