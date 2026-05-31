import assert from "node:assert/strict";
import test from "node:test";

import {
  applySessionHydratePayload,
  isAbortError,
  isServerUnauthenticatedPayload,
  isSessionHydrateFetchFailure,
} from "./session-hydrate";
import {
  buildSessionTokenStorageKey,
  SESSION_TOKEN_STORAGE_DEFAULT_SCOPE,
} from "./session";

const DEFAULT_SCOPED_KEY = buildSessionTokenStorageKey(SESSION_TOKEN_STORAGE_DEFAULT_SCOPE);

function mockBrowserWindow(localStorage: Storage): void {
  const g = globalThis as typeof globalThis & { window?: typeof globalThis.window };
  g.window = {
    localStorage,
    location: { hostname: "localhost" } as Location,
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
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
  } as Storage;
}

test("isAbortError detects AbortError and ERR_CANCELED", () => {
  assert.equal(isAbortError(new DOMException("aborted", "AbortError")), true);
  assert.equal(isAbortError(Object.assign(new Error("canceled"), { code: "ERR_CANCELED" })), true);
  assert.equal(isAbortError(new Error("network")), false);
});

test("isSessionHydrateFetchFailure treats abort and TypeError as transient", () => {
  assert.equal(isSessionHydrateFetchFailure(new DOMException("aborted", "AbortError")), true);
  assert.equal(isSessionHydrateFetchFailure(new TypeError("Failed to fetch")), true);
  assert.equal(isSessionHydrateFetchFailure(new Error("validation")), false);
});

test("applySessionHydratePayload clears mirror only when server unauthenticated", () => {
  const prior = globalThis.window;
  const storage = mockLocalStorage();
  storage.setItem(DEFAULT_SCOPED_KEY, "mirror");
  mockBrowserWindow(storage);

  try {
    const user = applySessionHydratePayload({ authenticated: false });
    assert.equal(user, null);
    assert.equal(storage.getItem(DEFAULT_SCOPED_KEY), null);
  } finally {
    restoreBrowserWindow(prior);
  }
});

test("applySessionHydratePayload overwrites stale localStorage mirror when cookie token differs", () => {
  const prior = globalThis.window;
  const localStorage = mockLocalStorage();
  localStorage.setItem(DEFAULT_SCOPED_KEY, "stale-mirror-token");
  mockBrowserWindow(localStorage);

  const header = Buffer.from(JSON.stringify({ alg: "RS256" }))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const body = Buffer.from(
    JSON.stringify({
      sub: "11111111-1111-4111-8111-111111111111",
      tenant_id: "22222222-2222-4222-8222-222222222222",
      role: "owner",
    }),
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const token = `${header}.${body}.sig`;

  try {
    applySessionHydratePayload({
      authenticated: true,
      session_token: token,
      user_id: "11111111-1111-4111-8111-111111111111",
      tenant_id: "22222222-2222-4222-8222-222222222222",
    });
    assert.equal(localStorage.getItem(DEFAULT_SCOPED_KEY), token);
  } finally {
    restoreBrowserWindow(prior);
  }
});

test("applySessionHydratePayload syncs token when authenticated", () => {
  const prior = globalThis.window;
  const localStorage = mockLocalStorage();
  mockBrowserWindow(localStorage);

  const header = Buffer.from(JSON.stringify({ alg: "RS256" }))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const body = Buffer.from(
    JSON.stringify({
      sub: "11111111-1111-4111-8111-111111111111",
      tenant_id: "22222222-2222-4222-8222-222222222222",
      role: "owner",
    }),
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const token = `${header}.${body}.sig`;

  try {
    const user = applySessionHydratePayload({
      authenticated: true,
      session_token: token,
      user_id: "11111111-1111-4111-8111-111111111111",
      tenant_id: "22222222-2222-4222-8222-222222222222",
    });
    assert.ok(user);
    assert.equal(globalThis.window?.localStorage.getItem(DEFAULT_SCOPED_KEY), token);
  } finally {
    restoreBrowserWindow(prior);
  }
});

test("isServerUnauthenticatedPayload is false for authenticated true", () => {
  assert.equal(isServerUnauthenticatedPayload({ authenticated: true }), false);
  assert.equal(isServerUnauthenticatedPayload({ authenticated: false }), true);
});
