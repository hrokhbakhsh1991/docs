export const THEME_STORAGE_KEY = "web-ui-playground-theme";

export type ThemeMode = "light" | "dark";

function browserWindow(): Window | undefined {
  if (typeof globalThis === "undefined") {
    return undefined;
  }
  return (globalThis as typeof globalThis & { window?: Window }).window;
}

export function applyThemeClass(theme: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  root.classList.remove("theme-light", "theme-dark");
  root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
}

/** Explicit user choice in localStorage, if any. */
export function readStoredThemePreference(): ThemeMode | null {
  const win = browserWindow();
  if (!win) {
    return null;
  }
  try {
    const stored = win.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function readSystemThemePreference(): ThemeMode {
  const win = browserWindow();
  if (!win || typeof win.matchMedia !== "function") {
    return "light";
  }
  return win.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Stored preference wins; otherwise follows `prefers-color-scheme`. */
export function resolveThemeMode(): ThemeMode {
  return readStoredThemePreference() ?? readSystemThemePreference();
}

/** Inline script for root layout — runs before React to avoid theme flash on refresh. */
export function buildThemeInitScript(): string {
  return `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var t=s==="dark"||s==="light"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var r=document.documentElement;r.classList.remove("theme-light","theme-dark");r.classList.add(t==="dark"?"theme-dark":"theme-light");}catch(e){}})();`;
}
