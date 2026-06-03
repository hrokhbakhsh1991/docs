"use client";

import type { ReactNode } from "react";

import "@app-tour/design-tokens/styles.css";

export type PlatformThemeMode = "light" | "dark";

export type PlatformThemeProviderProps = {
  mode: PlatformThemeMode;
  children: ReactNode;
};

export function PlatformThemeProvider({ mode, children }: PlatformThemeProviderProps) {
  const className = mode === "dark" ? "theme-dark" : "theme-light";
  return <div className={className}>{children}</div>;
}
