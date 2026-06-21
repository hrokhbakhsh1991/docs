/**
 * Phase 11.2 — workspace draft persistence (DEC-P11-003)
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { resetWorkspaceDraftEventsRepositorySingletonForTests } from "../src/workspace-drafts/create-workspace-draft-events-repository";
import { resetWorkspaceDraftsRepositorySingletonForTests } from "../src/workspace-drafts/create-workspace-drafts-repository";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { resetHttpIdempotencyMemoryForTests } from "../src/http/http-idempotency";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type DraftResponse = Record<string, unknown>;

const WORKSPACE_ID = "ws-operator-smoke";
const NAMESPACE = "operator.wizard";
const DRAFT_KEY = "denali-create";

function draftPath(): string {
  return `/workspaces/${WORKSPACE_ID}/drafts/${NAMESPACE}/${DRAFT_KEY}`;
}

function draftListPath(namespace?: string): string {
  const base = `/workspaces/${WORKSPACE_ID}/drafts`;
  return namespace === undefined ? base : `${base}?namespace=${encodeURIComponent(namespace)}`;
}

function draftEventsPath(): string {
  return `${draftPath()}/events`;
}

function resetDraftStoresForTests(): void {
  resetWorkspaceDraftsRepositorySingletonForTests();
  resetWorkspaceDraftEventsRepositorySingletonForTests();
}

function createDraftTestListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

describe("workspace-drafts.spec.ts — Phase 11.2 API", () => {
  const client = installHttpTestClient(createDraftTestListener);

  before(() => {
    seedOperatorIdentityFixture();
    resetDraftStoresForTests();
  });

  it("API-P11-2-01 GET missing draft returns 404", async () => {
    const response = await client.requestJson<DraftResponse>("GET", draftPath(), {
      headers: operatorAuthHeaders(),
    });
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "WORKSPACE_DRAFT_NOT_FOUND");
  });

  it("API-P11-2-02 PATCH version 0 creates version 1", async () => {
    const response = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: {
        data: { step: 1, title: "Draft tour" },
        version: 0,
        schemaVersion: 1,
        lastModified: 1_718_000_000_000,
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.version, 1);
    assert.equal(response.body.schemaVersion, 1);
    assert.equal(response.body.lastModified, 1_718_000_000_000);
    const data = response.body.data as Record<string, unknown>;
    assert.equal(data.title, "Draft tour");
  });

  it("API-P11-2-03 PATCH with matching version increments", async () => {
    const response = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: {
        data: { step: 2, title: "Updated draft" },
        version: 1,
        schemaVersion: 1,
        lastModified: 1_718_000_000_100,
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.version, 2);
    const data = response.body.data as Record<string, unknown>;
    assert.equal(data.title, "Updated draft");
  });

  it("API-P11-2-04 PATCH stale version returns 409 with server payload", async () => {
    const response = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: {
        data: { step: 9, title: "Stale" },
        version: 1,
        schemaVersion: 1,
        lastModified: 1_718_000_000_200,
      },
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "DRAFT_VERSION_CONFLICT");
    assert.equal(response.body.version, 2);
    const data = response.body.data as Record<string, unknown>;
    assert.equal(data.title, "Updated draft");
  });

  it("API-P11-2-05 DELETE then GET returns 404", async () => {
    const deleteResponse = await client.requestJson<DraftResponse>("DELETE", draftPath(), {
      headers: operatorAuthHeaders(),
    });
    assert.equal(deleteResponse.status, 204);

    const getResponse = await client.requestJson<DraftResponse>("GET", draftPath(), {
      headers: operatorAuthHeaders(),
    });
    assert.equal(getResponse.status, 404);
  });

  it("API-P11-2-06 wrong workspaceId returns 403", async () => {
    const response = await client.requestJson<DraftResponse>(
      "GET",
      `/workspaces/ws-other/drafts/${NAMESPACE}/${DRAFT_KEY}`,
      {
        headers: operatorAuthHeaders(),
      }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "WORKSPACE_DRAFT_FORBIDDEN");
  });

  it("API-P11-9-01 list with no drafts returns empty items", async () => {
    resetDraftStoresForTests();
    const response = await client.requestJson<DraftResponse>("GET", draftListPath(), {
      headers: operatorAuthHeaders(),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.items, []);
  });

  it("API-P11-9-02 list returns index row without data after create", async () => {
    resetDraftStoresForTests();
    await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: {
        data: { step: 1, title: "Listed draft" },
        version: 0,
        schemaVersion: 1,
        lastModified: 1_718_000_000_000,
      },
    });

    const response = await client.requestJson<DraftResponse>("GET", draftListPath(), {
      headers: operatorAuthHeaders(),
    });
    assert.equal(response.status, 200);
    const items = response.body.items as Array<Record<string, unknown>>;
    assert.equal(items.length, 1);
    assert.equal(items[0]?.draftNamespace, NAMESPACE);
    assert.equal(items[0]?.draftKey, DRAFT_KEY);
    assert.equal(items[0]?.version, 1);
    assert.equal("data" in (items[0] ?? {}), false);
  });

  it("API-P11-9-03 namespace query filters list rows", async () => {
    resetDraftStoresForTests();
    await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: {
        data: { title: "Denali draft" },
        version: 0,
        schemaVersion: 1,
        lastModified: 1_718_000_000_000,
      },
    });
    await client.requestJson<DraftResponse>(
      "PATCH",
      `/workspaces/${WORKSPACE_ID}/drafts/operator.settings/settings-hub`,
      {
        headers: operatorAuthHeaders(),
        body: {
          data: { tab: "equipment" },
          version: 0,
          schemaVersion: 1,
          lastModified: 1_718_000_000_001,
        },
      }
    );

    const filtered = await client.requestJson<DraftResponse>(
      "GET",
      draftListPath(NAMESPACE),
      { headers: operatorAuthHeaders() }
    );
    assert.equal(filtered.status, 200);
    const filteredItems = filtered.body.items as Array<Record<string, unknown>>;
    assert.equal(filteredItems.length, 1);
    assert.equal(filteredItems[0]?.draftNamespace, NAMESPACE);

    const all = await client.requestJson<DraftResponse>("GET", draftListPath(), {
      headers: operatorAuthHeaders(),
    });
    const allItems = all.body.items as Array<Record<string, unknown>>;
    assert.equal(allItems.length, 2);
  });

  it("API-P11-9-04 list wrong workspaceId returns 403", async () => {
    const response = await client.requestJson<DraftResponse>(
      "GET",
      `/workspaces/ws-other/drafts`,
      { headers: operatorAuthHeaders() }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "WORKSPACE_DRAFT_FORBIDDEN");
  });

  it("API-P11-9-05 PATCH create appends created audit event", async () => {
    resetDraftStoresForTests();
    await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: {
        data: { title: "Audited create" },
        version: 0,
        schemaVersion: 1,
        lastModified: 1_718_000_000_000,
      },
    });

    const events = await client.requestJson<DraftResponse>("GET", draftEventsPath(), {
      headers: operatorAuthHeaders(),
    });
    assert.equal(events.status, 200);
    const items = events.body.items as Array<Record<string, unknown>>;
    assert.equal(items.length, 1);
    assert.equal(items[0]?.action, "created");
    assert.equal(items[0]?.version, 1);
  });

  it("API-P11-9-06 PATCH update appends updated audit event", async () => {
    resetDraftStoresForTests();
    await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: {
        data: { title: "v1" },
        version: 0,
        schemaVersion: 1,
        lastModified: 1_718_000_000_000,
      },
    });
    await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: {
        data: { title: "v2" },
        version: 1,
        schemaVersion: 1,
        lastModified: 1_718_000_000_100,
      },
    });

    const events = await client.requestJson<DraftResponse>("GET", draftEventsPath(), {
      headers: operatorAuthHeaders(),
    });
    const items = events.body.items as Array<Record<string, unknown>>;
    assert.equal(items.length, 2);
    assert.equal(items[0]?.action, "updated");
    assert.equal(items[0]?.version, 2);
    assert.equal(items[1]?.action, "created");
  });

  it("API-P11-9-07 DELETE appends deleted audit event", async () => {
    resetDraftStoresForTests();
    await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: {
        data: { title: "to delete" },
        version: 0,
        schemaVersion: 1,
        lastModified: 1_718_000_000_000,
      },
    });
    await client.requestJson<DraftResponse>("DELETE", draftPath(), {
      headers: operatorAuthHeaders(),
    });

    const events = await client.requestJson<DraftResponse>("GET", draftEventsPath(), {
      headers: operatorAuthHeaders(),
    });
    const items = events.body.items as Array<Record<string, unknown>>;
    assert.equal(items.length, 2);
    assert.equal(items[0]?.action, "deleted");
    assert.equal(items[0]?.version, 1);
  });

  it("API-P11-9-08 GET events returns newest-first rows", async () => {
    resetDraftStoresForTests();
    for (let version = 0; version < 3; version += 1) {
      await client.requestJson<DraftResponse>("PATCH", draftPath(), {
        headers: operatorAuthHeaders(),
        body: {
          data: { title: `step-${version}` },
          version,
          schemaVersion: 1,
          lastModified: 1_718_000_000_000 + version,
        },
      });
    }

    const events = await client.requestJson<DraftResponse>(
      "GET",
      `${draftEventsPath()}?limit=2`,
      { headers: operatorAuthHeaders() }
    );
    const items = events.body.items as Array<Record<string, unknown>>;
    assert.equal(items.length, 2);
    assert.equal(items[0]?.version, 3);
    assert.equal(items[1]?.version, 2);
  });

  it("API-P11-2-07 PATCH Idempotency-Key replays same 200 body", async () => {
    resetDraftStoresForTests();
    const idempotencyKey = randomUUID();
    const body = {
      data: { title: "idempotent-draft" },
      version: 0,
      schemaVersion: 1,
      lastModified: 1_718_000_000_000,
    };
    const headers = { ...operatorAuthHeaders(), "Idempotency-Key": idempotencyKey };

    const first = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers,
      body,
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.version, 1);

    const second = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers,
      body,
    });
    assert.equal(second.status, 200);
    assert.deepEqual(second.body, first.body);
  });

  it("API-P11-2-08 PATCH Idempotency-Key with different body returns 409 mismatch", async () => {
    resetDraftStoresForTests();
    resetHttpIdempotencyMemoryForTests();
    const idempotencyKey = randomUUID();
    const headers = { ...operatorAuthHeaders(), "Idempotency-Key": idempotencyKey };

    const first = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers,
      body: {
        data: { title: "first-body" },
        version: 0,
        schemaVersion: 1,
        lastModified: 1_718_000_000_000,
      },
    });
    assert.equal(first.status, 200);

    const second = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers,
      body: {
        data: { title: "different-body" },
        version: 0,
        schemaVersion: 1,
        lastModified: 1_718_000_000_001,
      },
    });
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "IDEMPOTENCY_PAYLOAD_MISMATCH");
  });
});
