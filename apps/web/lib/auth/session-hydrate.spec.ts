import assert from "node:assert/strict";
import test from "node:test";

import {
  applySessionHydratePayload,
  isAbortError,
  isServerUnauthenticatedPayload,
  isSessionHydrateFetchFailure,
} from "./session-hydrate";

const STORAGE_KEY = "tour_ops_session_token";

function mockLocalStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
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
  const g = globalThis as typeof globalThis & { window?: { localStorage: Storage } };
  const prior = g.window;
  const storage = mockLocalStorage();
  storage.setItem(STORAGE_KEY, "mirror");
  g.window = { localStorage: storage };

  try {
    const user = applySessionHydratePayload({ authenticated: false });
    assert.equal(user, null);
    assert.equal(storage.getItem(STORAGE_KEY), null);
  } finally {
    if (prior === undefined) {
      delete g.window;
    } else {
      g.window = prior;
    }
  }
});

test("applySessionHydratePayload overwrites stale localStorage mirror when cookie token differs", () => {
  const g = globalThis as typeof globalThis & { window?: { localStorage: Storage } };
  const prior = g.window;
  const localStorage = mockLocalStorage();
  localStorage.setItem(STORAGE_KEY, "stale-mirror-token");
  g.window = { localStorage };

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
    assert.equal(localStorage.getItem(STORAGE_KEY), token);
  } finally {
    if (prior === undefined) {
      delete g.window;
    } else {
      g.window = prior;
    }
  }
});

test("applySessionHydratePayload syncs token when authenticated", () => {
  const g = globalThis as typeof globalThis & { window?: { localStorage: Storage } };
  const prior = g.window;
  const localStorage = mockLocalStorage();
  g.window = { localStorage };

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
    assert.equal(g.window?.localStorage.getItem(STORAGE_KEY), token);
  } finally {
    if (prior === undefined) {
      delete g.window;
    } else {
      g.window = prior;
    }
  }
});

test("isServerUnauthenticatedPayload is false for authenticated true", () => {
  assert.equal(isServerUnauthenticatedPayload({ authenticated: true }), false);
  assert.equal(isServerUnauthenticatedPayload({ authenticated: false }), true);
});
