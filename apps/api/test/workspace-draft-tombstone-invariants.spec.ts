/**
 * Phase 6 — envelope tombstone invariants (G-API-04)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import {
  assertEnvelopeTombstoneInvariants,
  ENVELOPE_TOMBSTONE_PATCH_NAMESPACES,
} from "../src/workspace-drafts/invariants/envelope-tombstone-invariants";
import { resetWorkspaceDraftEventsRepositorySingletonForTests } from "../src/workspace-drafts/create-workspace-draft-events-repository";
import { resetWorkspaceDraftsRepositorySingletonForTests } from "../src/workspace-drafts/create-workspace-drafts-repository";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

const INVARIANT_SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/workspace-drafts/invariants/envelope-tombstone-invariants.ts"
);

type DraftResponse = Record<string, unknown>;

const WORKSPACE_ID = "ws-operator-smoke";
const WIZARD_NAMESPACE = "operator.wizard";
const OTHER_NAMESPACE = "operator.settings";
const DRAFT_KEY = "denali-create";

function draftPath(namespace: string = WIZARD_NAMESPACE): string {
  return `/workspaces/${WORKSPACE_ID}/drafts/${namespace}/${DRAFT_KEY}`;
}

function draftEventsPath(namespace: string = WIZARD_NAMESPACE): string {
  return `${draftPath(namespace)}/events`;
}

function resetDraftStoresForTests(): void {
  resetWorkspaceDraftsRepositorySingletonForTests();
  resetWorkspaceDraftEventsRepositorySingletonForTests();
}

function patchBody(data: unknown, version = 0) {
  return {
    data,
    version,
    schemaVersion: 1,
    lastModified: 1_718_000_000_000,
  };
}

describe("envelope-tombstone-invariants — unit", () => {
  it("API-P11-TOMB-03 unit — opaque blob passes through", () => {
    const result = assertEnvelopeTombstoneInvariants({ step: 1, title: "plain" });
    assert.deepEqual(result, { ok: true });
  });

  it("API-P11-TOMB-03 unit — envelope without deletedRoots passes", () => {
    const result = assertEnvelopeTombstoneInvariants({
      form: { data: { timetable: { days: [] } } },
      meta: { step: 1 },
    });
    assert.deepEqual(result, { ok: true });
  });

  it("API-P11-TOMB-01 unit — resurrected root key fails", () => {
    const result = assertEnvelopeTombstoneInvariants({
      form: { data: { timetable: { days: [] }, pricing: {} } },
      meta: { deletedRoots: ["timetable"] },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "TOMBSTONE_RESURRECTION");
      assert.deepEqual(result.keys, ["timetable"]);
    }
  });

  it("API-P11-TOMB-02 unit — deletedRoots not array fails", () => {
    const result = assertEnvelopeTombstoneInvariants({
      form: { data: {} },
      meta: { deletedRoots: "timetable" },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "DELETED_ROOTS_NOT_ARRAY");
    }
  });

  it("API-P11-TOMB-02 unit — non-string element in deletedRoots fails", () => {
    const result = assertEnvelopeTombstoneInvariants({
      form: { data: {} },
      meta: { deletedRoots: [1, "ok"] },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "DELETED_ROOTS_NOT_ARRAY");
    }
  });

  it("operator.wizard is tombstone-gated namespace", () => {
    assert.equal(ENVELOPE_TOMBSTONE_PATCH_NAMESPACES.has("operator.wizard"), true);
  });
});

describe("workspace-draft-tombstone-invariants.spec.ts — Phase 6 HTTP", () => {
  const client = installHttpTestClient(() =>
    createRequestListener({ toursService: createTestToursService() })
  );

  before(() => {
    seedOperatorIdentityFixture();
    resetDraftStoresForTests();
  });

  it("API-P11-GEN-01 — invariant module has zero workspace-denali imports", () => {
    const source = readFileSync(INVARIANT_SOURCE, "utf8");
    assert.doesNotMatch(source, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(source, /workspace-denali/);
  });

  it("API-P11-TOMB-01 PATCH rejects tombstone resurrection with 400", async () => {
    resetDraftStoresForTests();
    const response = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: patchBody({
        form: { data: { timetable: { days: [] } } },
        meta: { deletedRoots: ["timetable"] },
      }),
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "TOMBSTONE_RESURRECTION");
    assert.deepEqual(response.body.keys, ["timetable"]);

    const events = await client.requestJson<DraftResponse>("GET", draftEventsPath(), {
      headers: operatorAuthHeaders(),
    });
    const items = events.body.items as Array<Record<string, unknown>>;
    assert.equal(items.length, 1);
    assert.equal(items[0]?.action, "tombstone_violation");
    assert.equal(items[0]?.version, null);
  });

  it("API-P11-TOMB-02 PATCH rejects non-array deletedRoots with 400", async () => {
    resetDraftStoresForTests();
    const response = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: patchBody({
        form: { data: {} },
        meta: { deletedRoots: "timetable" },
      }),
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "DELETED_ROOTS_NOT_ARRAY");
  });

  it("API-P11-TOMB-03 PATCH accepts opaque non-envelope data", async () => {
    resetDraftStoresForTests();
    const response = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: patchBody({ step: 1, title: "plain draft" }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.version, 1);
    const data = response.body.data as Record<string, unknown>;
    assert.equal(data.title, "plain draft");
  });

  it("API-P11-TOMB-03 PATCH accepts valid envelope with tombstoned-only roots", async () => {
    resetDraftStoresForTests();
    const response = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: patchBody({
        form: { data: { pricing: { currency: "USD" } } },
        meta: { deletedRoots: ["timetable"] },
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.version, 1);
  });

  it("tombstone gate skipped for non-wizard namespace", async () => {
    resetDraftStoresForTests();
    const response = await client.requestJson<DraftResponse>("PATCH", draftPath(OTHER_NAMESPACE), {
      headers: operatorAuthHeaders(),
      body: patchBody({
        form: { data: { timetable: {} } },
        meta: { deletedRoots: ["timetable"] },
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.version, 1);
  });
});
