import assert from "node:assert/strict";
import test from "node:test";

import {
  buildThemeInitScript,
  readStoredThemePreference,
  resolveThemeMode,
  THEME_STORAGE_KEY,
} from "./theme-preference";

test("resolveThemeMode prefers localStorage over system", () => {
  const g = globalThis as typeof globalThis & {
    window?: Window & { localStorage: Storage; matchMedia: (q: string) => { matches: boolean } };
  };
  const store = new Map<string, string>();
  const prior = g.window;
  g.window = {
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage,
    matchMedia: () => ({ matches: true }),
  };

  try {
    store.set(THEME_STORAGE_KEY, "light");
    assert.equal(resolveThemeMode(), "light");
    store.delete(THEME_STORAGE_KEY);
    assert.equal(resolveThemeMode(), "dark");
  } finally {
    if (prior === undefined) {
      delete g.window;
    } else {
      g.window = prior;
    }
  }
});

test("buildThemeInitScript references storage key", () => {
  assert.match(buildThemeInitScript(), new RegExp(THEME_STORAGE_KEY));
});

test("readStoredThemePreference returns null when unset", () => {
  const g = globalThis as typeof globalThis & { window?: { localStorage: Storage } };
  const prior = g.window;
  g.window = {
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } as Storage,
  };
  try {
    assert.equal(readStoredThemePreference(), null);
  } finally {
    if (prior === undefined) {
      delete g.window;
    } else {
      g.window = prior;
    }
  }
});
