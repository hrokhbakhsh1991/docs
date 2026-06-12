"use client";

import { useEffect, useState } from "react";

import { applyOperatorThemeMode, readInitialOperatorThemeDark } from "./operator-theme-mode";

/** SSR-safe operator/wizard theme toggle — reads localStorage only after mount. */
export function useOperatorThemeToggleState() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = readInitialOperatorThemeDark();
    setDark(initial);
    applyOperatorThemeMode(initial);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    applyOperatorThemeMode(dark);
  }, [dark, mounted]);

  return {
    dark,
    mounted,
    toggle: () => setDark((value) => !value),
  };
}
