import assert from "node:assert/strict";
import test from "node:test";

import {
  buildThemeInitScript,
  readStoredThemePreference,
  resolveThemeMode,
  THEME_STORAGE_KEY,
  writeStoredThemePreference,
} from "./theme-preference";

type WindowStub = Pick<Window, "localStorage" | "matchMedia">;

function installWindowStub(stub: WindowStub): () => void {
  const prior = (globalThis as { window?: WindowStub }).window;
  Object.defineProperty(globalThis, "window", {
    value: stub,
    writable: true,
    configurable: true,
  });
  return () => {
    if (prior === undefined) {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      Object.defineProperty(globalThis, "window", {
        value: prior,
        writable: true,
        configurable: true,
      });
    }
  };
}

test("resolveThemeMode prefers localStorage over system", () => {
  const store = new Map<string, string>();
  const restoreWindow = installWindowStub({
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage,
    matchMedia: () => ({ matches: true }) as MediaQueryList,
  });

  try {
    writeStoredThemePreference("light");
    assert.equal(resolveThemeMode(), "light");
    store.delete(THEME_STORAGE_KEY);
    assert.equal(resolveThemeMode(), "dark");
  } finally {
    restoreWindow();
  }
});

test("buildThemeInitScript references storage key", () => {
  assert.match(buildThemeInitScript(), new RegExp(THEME_STORAGE_KEY));
});

test("readStoredThemePreference returns null when unset", () => {
  const restoreWindow = installWindowStub({
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    } as Storage,
    matchMedia: () => ({ matches: false }) as MediaQueryList,
  });

  try {
    assert.equal(readStoredThemePreference(), null);
  } finally {
    restoreWindow();
  }
});
