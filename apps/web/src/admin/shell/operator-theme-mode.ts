export const OPERATOR_THEME_STORAGE_KEY = "operator-theme-mode" as const;

export function readInitialOperatorThemeDark(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const stored = window.localStorage.getItem(OPERATOR_THEME_STORAGE_KEY);
  if (stored === "dark") {
    return true;
  }
  if (stored === "light") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyOperatorThemeMode(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
  const tenantRoot = document.querySelector("[data-tenant-theme]");
  const platformRoot = tenantRoot?.parentElement;
  if (platformRoot instanceof HTMLElement) {
    platformRoot.classList.remove("theme-light", "theme-dark");
    platformRoot.classList.add(dark ? "theme-dark" : "theme-light");
  }
  try {
    window.localStorage.setItem(OPERATOR_THEME_STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // private mode / blocked storage
  }
}
