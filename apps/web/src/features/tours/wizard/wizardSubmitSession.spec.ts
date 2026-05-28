import assert from "node:assert/strict";
import test from "node:test";

import {
  clearWizardSubmitIdempotencyKey,
  getWizardSubmitIdempotencyKey,
} from "./wizardSubmitSession";

function mockSessionStorage(): Map<string, string> {
  const storage = new Map<string, string>();
  const g = globalThis as typeof globalThis & { window?: { sessionStorage: Storage } };
  g.window = {
    sessionStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
      clear: () => storage.clear(),
      key: () => null,
      length: storage.size,
    },
  } as unknown as Window & typeof globalThis;
  return storage;
}

test("getWizardSubmitIdempotencyKey is stable until cleared", () => {
  const storage = mockSessionStorage();
  storage.clear();
  const workspaceId = "tenant-a";

  const a = getWizardSubmitIdempotencyKey(workspaceId);
  const b = getWizardSubmitIdempotencyKey(workspaceId);
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f-]{36}$/i);

  clearWizardSubmitIdempotencyKey(workspaceId);
  const c = getWizardSubmitIdempotencyKey(workspaceId);
  assert.notEqual(a, c);
});

test("workspace scope keeps idempotency keys isolated", () => {
  const storage = mockSessionStorage();
  storage.clear();

  const a = getWizardSubmitIdempotencyKey("tenant-a");
  const b = getWizardSubmitIdempotencyKey("tenant-b");

  assert.notEqual(a, b);
  assert.equal(getWizardSubmitIdempotencyKey("tenant-a"), a);
  assert.equal(getWizardSubmitIdempotencyKey("tenant-b"), b);
});
