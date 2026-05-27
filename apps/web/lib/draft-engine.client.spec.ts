import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { DraftConflictError } from "@repo/draft-engine";

import { fetchDraftSnapshot, patchDraftSnapshot } from "./draft-engine.client";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("fetchDraftSnapshot requests workspace-scoped draft path", async () => {
  let requestedUrl = "";
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
  };

  const result = await fetchDraftSnapshot("tenant-workspace-a", "denali-create");
  assert.equal(result, null);
  assert.match(requestedUrl, /\/api\/workspaces\/tenant-workspace-a\/draft-engine\/denali-create$/);
});

test("patchDraftSnapshot maps 409 conflict body to DraftConflictError", async () => {
  const serverPayload = {
    data: { form: { title: "server" }, currentStepIndex: 2 },
    version: 3,
    schemaVersion: 1,
    lastModified: 1_700_000_000_000,
  };

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: "DRAFT_CONFLICT",
          details: { server: serverPayload },
        },
      }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    );

  await assert.rejects(
    () =>
      patchDraftSnapshot("tenant-workspace-a", "denali-create", {
        data: { form: { title: "local" }, currentStepIndex: 1 },
        version: 2,
        schemaVersion: 1,
        lastModified: 1_700_000_000_001,
      }),
    (error: unknown) => {
      assert.ok(error instanceof DraftConflictError);
      assert.deepEqual((error as DraftConflictError<unknown>).serverPayload, serverPayload);
      return true;
    },
  );
});

test("patchDraftSnapshot throws when 409 body lacks server payload", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "conflict" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });

  await assert.rejects(
    () =>
      patchDraftSnapshot("tenant-workspace-a", "denali-create", {
        data: { title: "local" },
        version: 0,
        schemaVersion: 1,
        lastModified: Date.now(),
      }),
    /conflict without server payload/,
  );
});
