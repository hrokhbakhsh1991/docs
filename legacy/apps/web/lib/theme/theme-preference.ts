import {
  buildScopedStorageKey,
  createScopedLocalStorage,
  SCOPED_STORAGE_DEVICE_TENANT,
} from "@/lib/storage/scoped-storage";

const THEME_NAMESPACE = "ui";
const THEME_LOGICAL_KEY = "theme-preference";

/** Fully scoped localStorage key for theme preference (`ui:_device:theme-preference`). */
export const THEME_STORAGE_KEY = buildScopedStorageKey(
  THEME_NAMESPACE,
  SCOPED_STORAGE_DEVICE_TENANT,
  THEME_LOGICAL_KEY,
);

const LEGACY_THEME_KEYS = ["web-ui-playground-theme", "theme"] as const;

export type ThemeMode = "light" | "dark";

function themeStorage() {
  return createScopedLocalStorage(THEME_NAMESPACE, SCOPED_STORAGE_DEVICE_TENANT);
}

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

function migrateLegacyThemePreference(storage: ReturnType<typeof themeStorage>): ThemeMode | null {
  for (const legacyKey of LEGACY_THEME_KEYS) {
    const migrated = storage.migrateLegacyItem(THEME_LOGICAL_KEY, legacyKey);
    if (migrated === "light" || migrated === "dark") {
      return migrated;
    }
  }
  return null;
}

/** Explicit user choice in localStorage, if any. */
export function readStoredThemePreference(): ThemeMode | null {
  if (!browserWindow()) {
    return null;
  }
  try {
    const storage = themeStorage();
    const migrated = migrateLegacyThemePreference(storage);
    if (migrated) {
      return migrated;
    }
    const stored = storage.getItem(THEME_LOGICAL_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredThemePreference(theme: ThemeMode): void {
  themeStorage().setItem(THEME_LOGICAL_KEY, theme);
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
