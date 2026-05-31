import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSessionTokenStorageKey,
  clearSessionStorageMirror,
  ensureSessionStorageSync,
  getStoredSessionToken,
  LEGACY_SESSION_TOKEN_STORAGE_KEY,
  resolveSessionStorageScope,
  SESSION_TOKEN_STORAGE_DEFAULT_SCOPE,
  SESSION_TOKEN_STORAGE_KEY_PREFIX,
} from "./session";

function mockJwt(sub: string): string {
  const payload = Buffer.from(JSON.stringify({ sub }), "utf8").toString("base64");
  return `hdr.${payload}.sig`;
}

const USER_A = "user-a-1111-2222-3333-444444444444";
const USER_B = "user-b-5555-6666-7777-888888888888";
const JWT_A = mockJwt(USER_A);
const JWT_B = mockJwt(USER_B);
const DEFAULT_KEY = `${SESSION_TOKEN_STORAGE_KEY_PREFIX}:${SESSION_TOKEN_STORAGE_DEFAULT_SCOPE}`;

function scopedKeyForToken(token: string): string {
  return buildSessionTokenStorageKey(undefined, token);
}

function mockBrowserWindow(storage: Storage, hostname = "localhost"): void {
  const g = globalThis as typeof globalThis & { window?: typeof globalThis.window };
  g.window = {
    localStorage: storage,
    location: { hostname } as Location,
  } as unknown as typeof globalThis.window;
}

function restoreBrowserWindow(prior: typeof globalThis.window | undefined): void {
  const g = globalThis as typeof globalThis & { window?: typeof globalThis.window };
  if (prior === undefined) {
    Reflect.deleteProperty(globalThis, "window");
  } else {
    g.window = prior;
  }
}

function mockLocalStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
  } as Storage;
}

test("ensureSessionStorageSync writes token when localStorage is empty", () => {
  const prior = globalThis.window;
  const storage = mockLocalStorage();
  mockBrowserWindow(storage);

  try {
    ensureSessionStorageSync(JWT_A);
    const scopedKey = scopedKeyForToken(JWT_A);
    assert.equal(getStoredSessionToken(undefined, JWT_A), JWT_A);
    assert.equal(storage.getItem(scopedKey), JWT_A);
  } finally {
    restoreBrowserWindow(prior);
  }
});

test("ensureSessionStorageSync updates token when cookie token differs", () => {
  const prior = globalThis.window;
  const storage = mockLocalStorage();
  storage.setItem(scopedKeyForToken(JWT_A), "existing");
  mockBrowserWindow(storage);

  try {
    ensureSessionStorageSync(JWT_A);
    assert.equal(getStoredSessionToken(undefined, JWT_A), JWT_A);
  } finally {
    restoreBrowserWindow(prior);
  }
});

test("ensureSessionStorageSync keeps token when unchanged", () => {
  const prior = globalThis.window;
  const storage = mockLocalStorage();
  storage.setItem(scopedKeyForToken(JWT_A), JWT_A);
  mockBrowserWindow(storage);

  try {
    ensureSessionStorageSync(JWT_A);
    assert.equal(getStoredSessionToken(undefined, JWT_A), JWT_A);
  } finally {
    restoreBrowserWindow(prior);
  }
});

test("clearSessionStorageMirror removes the Bearer mirror", () => {
  const prior = globalThis.window;
  const storage = mockLocalStorage();
  storage.setItem(scopedKeyForToken(JWT_A), "stale");
  mockBrowserWindow(storage);

  try {
    clearSessionStorageMirror();
    assert.equal(getStoredSessionToken(undefined, JWT_A), null);
  } finally {
    restoreBrowserWindow(prior);
  }
});

test("clearSessionStorageMirror evicts every tour_ops_session_token:* partition", () => {
  const prior = globalThis.window;
  const storage = mockLocalStorage();
  storage.setItem("tour_ops_session_token:ws1-rbac", "a");
  storage.setItem("tour_ops_session_token:ws2-rbac", "b");
  storage.setItem("tour_ops_session_token:_default", "c");
  storage.setItem(LEGACY_SESSION_TOKEN_STORAGE_KEY, "legacy");
  mockBrowserWindow(storage);

  try {
    clearSessionStorageMirror();
    assert.equal(storage.getItem("tour_ops_session_token:ws1-rbac"), null);
    assert.equal(storage.getItem("tour_ops_session_token:ws2-rbac"), null);
    assert.equal(storage.getItem("tour_ops_session_token:_default"), null);
    assert.equal(storage.getItem(LEGACY_SESSION_TOKEN_STORAGE_KEY), null);
  } finally {
    restoreBrowserWindow(prior);
  }
});

test("getStoredSessionToken migrates legacy unscoped localStorage key", () => {
  const prior = globalThis.window;
  const storage = mockLocalStorage();
  storage.setItem(LEGACY_SESSION_TOKEN_STORAGE_KEY, JWT_A);
  mockBrowserWindow(storage);

  try {
    assert.equal(getStoredSessionToken(undefined, JWT_A), JWT_A);
    assert.equal(storage.getItem(scopedKeyForToken(JWT_A)), JWT_A);
    assert.equal(storage.getItem(LEGACY_SESSION_TOKEN_STORAGE_KEY), null);
  } finally {
    restoreBrowserWindow(prior);
  }
});

test("buildSessionTokenStorageKey partitions by host subdomain slug", () => {
  const prior = globalThis.window;
  const storage = mockLocalStorage();
  mockBrowserWindow(storage, "ws1-rbac.localhost");

  try {
    assert.equal(buildSessionTokenStorageKey(), "tour_ops_session_token:ws1-rbac");
  } finally {
    restoreBrowserWindow(prior);
  }
});

test("resolveSessionStorageScope uses per-user localhost scope from JWT sub", () => {
  const prior = globalThis.window;
  const storage = mockLocalStorage();
  mockBrowserWindow(storage);

  try {
    assert.equal(resolveSessionStorageScope(JWT_A), `localhost_user_${USER_A}`);
    assert.equal(resolveSessionStorageScope(JWT_B), `localhost_user_${USER_B}`);
    ensureSessionStorageSync(JWT_A);
    ensureSessionStorageSync(JWT_B);
    const keyA = scopedKeyForToken(JWT_A);
    const keyB = scopedKeyForToken(JWT_B);
    assert.equal(storage.getItem(keyA), JWT_A);
    assert.equal(storage.getItem(keyB), JWT_B);
    assert.notEqual(keyA, keyB);
  } finally {
    restoreBrowserWindow(prior);
  }
});

test("getStoredSessionToken migrates loopback _default partition to user scope", () => {
  const prior = globalThis.window;
  const storage = mockLocalStorage();
  storage.setItem(DEFAULT_KEY, JWT_A);
  mockBrowserWindow(storage);

  try {
    assert.equal(getStoredSessionToken(undefined, JWT_A), JWT_A);
    assert.equal(storage.getItem(scopedKeyForToken(JWT_A)), JWT_A);
    assert.equal(storage.getItem(DEFAULT_KEY), null);
  } finally {
    restoreBrowserWindow(prior);
  }
});
