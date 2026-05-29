import assert from "node:assert/strict";
import test from "node:test";

import {
  clearSessionStorageMirror,
  ensureSessionStorageSync,
  getStoredSessionToken,
} from "./session";

const STORAGE_KEY = "tour_ops_session_token";

function mockLocalStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

test("ensureSessionStorageSync writes token when localStorage is empty", () => {
  const g = globalThis as typeof globalThis & { window?: { localStorage: Storage } };
  const prior = g.window;
  const storage = mockLocalStorage();
  g.window = { localStorage: storage };

  try {
    ensureSessionStorageSync("jwt-from-cookie");
    assert.equal(getStoredSessionToken(), "jwt-from-cookie");
    assert.equal(storage.getItem(STORAGE_KEY), "jwt-from-cookie");
  } finally {
    if (prior === undefined) {
      delete g.window;
    } else {
      g.window = prior;
    }
  }
});

test("ensureSessionStorageSync updates token when cookie token differs", () => {
  const g = globalThis as typeof globalThis & { window?: { localStorage: Storage } };
  const prior = g.window;
  const storage = mockLocalStorage();
  storage.setItem(STORAGE_KEY, "existing");
  g.window = { localStorage: storage };

  try {
    ensureSessionStorageSync("jwt-from-cookie");
    assert.equal(getStoredSessionToken(), "jwt-from-cookie");
  } finally {
    if (prior === undefined) {
      delete g.window;
    } else {
      g.window = prior;
    }
  }
});

test("ensureSessionStorageSync keeps token when unchanged", () => {
  const g = globalThis as typeof globalThis & { window?: { localStorage: Storage } };
  const prior = g.window;
  const storage = mockLocalStorage();
  storage.setItem(STORAGE_KEY, "same");
  g.window = { localStorage: storage };

  try {
    ensureSessionStorageSync("same");
    assert.equal(getStoredSessionToken(), "same");
  } finally {
    if (prior === undefined) {
      delete g.window;
    } else {
      g.window = prior;
    }
  }
});

test("clearSessionStorageMirror removes the Bearer mirror", () => {
  const g = globalThis as typeof globalThis & { window?: { localStorage: Storage } };
  const prior = g.window;
  const storage = mockLocalStorage();
  storage.setItem(STORAGE_KEY, "stale");
  g.window = { localStorage: storage };

  try {
    clearSessionStorageMirror();
    assert.equal(getStoredSessionToken(), null);
  } finally {
    if (prior === undefined) {
      delete g.window;
    } else {
      g.window = prior;
    }
  }
});
