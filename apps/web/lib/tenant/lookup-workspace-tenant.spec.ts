import assert from "node:assert/strict";
import test, { afterEach, beforeEach, mock } from "node:test";

import {
  lookupWorkspaceTenantExists,
  resetWorkspaceLookupCacheForTests,
} from "./lookup-workspace-tenant";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetWorkspaceLookupCacheForTests();
  process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN = "localhost";
  process.env.WORKSPACE_LOOKUP_CACHE_TTL_MS = "60000";
});

afterEach(() => {
  resetWorkspaceLookupCacheForTests();
  globalThis.fetch = originalFetch;
  mock.restoreAll();
});

test("lookupWorkspaceTenantExists rejects invalid label without fetch", async () => {
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response("{}", { status: 200 });
  };

  const known = await lookupWorkspaceTenantExists("www");
  assert.equal(known, false);
  assert.equal(fetchCalls, 0);
});

test("lookupWorkspaceTenantExists caches successful probe", async () => {
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  assert.equal(await lookupWorkspaceTenantExists("ws1-rbac"), true);
  assert.equal(await lookupWorkspaceTenantExists("ws1-rbac"), true);
  assert.equal(fetchCalls, 1);
});
