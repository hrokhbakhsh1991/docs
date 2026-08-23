/**
 * Track A — server-authoritative tombstone recompute on PATCH (operator.wizard)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { resetWorkspaceDraftEventsRepositorySingletonForTests } from "../src/workspace-drafts/create-workspace-draft-events-repository";
import { resetWorkspaceDraftsRepositorySingletonForTests } from "../src/workspace-drafts/create-workspace-drafts-repository";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";
import { patchWorkspaceDraft } from "../src/workspace-drafts/workspace-drafts.service";
import { WorkspaceDraftWorkspaceTypeRequiredError } from "../src/workspace-drafts/workspace-drafts.errors";

installMemoryStorageDriverForDescribe();

type DraftResponse = Record<string, unknown>;

const WORKSPACE_ID = "ws-operator-smoke";
const STARTER_TENANT_ID = "00000000-0000-4000-8000-000000000001";
const STARTER_WORKSPACE_ID = "ws-starter-draft-tombstone";
const WIZARD_NAMESPACE = "operator.wizard";
const DRAFT_KEY = "denali-create";

function draftPath(workspaceId = WORKSPACE_ID): string {
  return `/workspaces/${workspaceId}/drafts/${WIZARD_NAMESPACE}/${DRAFT_KEY}`;
}

function starterAuthHeaders(): Record<string, string> {
  return {
    "x-tenant-id": STARTER_TENANT_ID,
    "x-authenticated-tenant-id": STARTER_TENANT_ID,
    "x-user-id": OPERATOR_SMOKE.ownerUserId,
    "x-actor-role": "owner",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": STARTER_WORKSPACE_ID,
  };
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

describe("workspace-draft-server-tombstone.spec.ts — Track A", () => {
  const client = installHttpTestClient(() =>
    createRequestListener({ toursService: createTestToursService() })
  );

  before(() => {
    seedOperatorIdentityFixture();
    resetDraftStoresForTests();
    const repo = getIdentityRepository();
    repo.seedMembership({
      userId: OPERATOR_SMOKE.ownerUserId,
      tenantId: STARTER_TENANT_ID,
      role: "owner",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: STARTER_WORKSPACE_ID,
    });
  });

  it("A1 TOMBSTONE_RESURRECTION cannot occur when server recomputes on v0", async () => {
    resetDraftStoresForTests();
    const response = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: patchBody({
        form: { data: { photos: [{ id: "p1" }] } },
        meta: { deletedRoots: ["photos"] },
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.version, 1);
    const persisted = response.body.data as {
      form: { data: Record<string, unknown> };
      meta: Record<string, unknown>;
    };
    assert.ok("photos" in persisted.form.data);
    assert.equal(persisted.meta.deletedRoots, undefined);
  });

  it("A2 real delete v2 — server recomputes deletedRoots from baseline diff", async () => {
    resetDraftStoresForTests();
    const v1 = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: patchBody({
        form: { data: { photos: [{ id: "p1" }], title: "Tour" } },
        meta: { step: 1 },
      }),
    });
    assert.equal(v1.status, 200);
    assert.equal(v1.body.version, 1);

    const v2 = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: {
        ...patchBody(
          {
            form: { data: { title: "Tour" } },
            meta: { step: 2, deletedRoots: [] },
          },
          1
        ),
        lastModified: 1_718_000_000_001,
      },
    });
    assert.equal(v2.status, 200);
    assert.equal(v2.body.version, 2);
    const persisted = v2.body.data as {
      form: { data: Record<string, unknown> };
      meta: { deletedRoots?: string[] };
    };
    assert.equal("photos" in persisted.form.data, false);
    assert.deepEqual(persisted.meta.deletedRoots, ["photos"]);
  });

  it("A3 v2 client resurrection hint cleared when form still has photos — 200", async () => {
    resetDraftStoresForTests();
    const v1 = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: patchBody({
        form: { data: { photos: [{ id: "p1" }] } },
        meta: {},
      }),
    });
    assert.equal(v1.status, 200);

    const v2 = await client.requestJson<DraftResponse>("PATCH", draftPath(), {
      headers: operatorAuthHeaders(),
      body: {
        ...patchBody(
          {
            form: { data: { photos: [{ id: "p1" }] } },
            meta: { deletedRoots: ["photos"] },
          },
          1
        ),
        lastModified: 1_718_000_000_001,
      },
    });
    assert.equal(v2.status, 200);
    assert.equal(v2.body.version, 2);
    const persisted = v2.body.data as {
      form: { data: Record<string, unknown> };
      meta: Record<string, unknown>;
    };
    assert.ok("photos" in persisted.form.data);
    assert.equal(persisted.meta.deletedRoots, undefined);
  });

  it("A4 starter noop binding — root removal does not persist deletedRoots", async () => {
    resetDraftStoresForTests();
    const path = draftPath(STARTER_WORKSPACE_ID);
    const v1 = await client.requestJson<DraftResponse>("PATCH", path, {
      headers: starterAuthHeaders(),
      body: patchBody({
        form: { data: { photos: [{ id: "p1" }], title: "Starter tour" } },
        meta: { step: 1 },
      }),
    });
    assert.equal(v1.status, 200);

    const v2 = await client.requestJson<DraftResponse>("PATCH", path, {
      headers: starterAuthHeaders(),
      body: {
        ...patchBody(
          {
            form: { data: { title: "Starter tour" } },
            meta: { step: 2, deletedRoots: ["photos"] },
          },
          1
        ),
        lastModified: 1_718_000_000_001,
      },
    });
    assert.equal(v2.status, 200);
    const persisted = v2.body.data as {
      form: { data: Record<string, unknown> };
      meta: Record<string, unknown>;
    };
    assert.equal("photos" in persisted.form.data, false);
    assert.equal(persisted.meta.deletedRoots, undefined);
  });

  it("A5 tombstone-gated patch requires an active workspaceType context", async () => {
    resetDraftStoresForTests();

    await assert.rejects(
      () =>
        patchWorkspaceDraft(
          {
            tenantId: STARTER_TENANT_ID,
            userId: OPERATOR_SMOKE.ownerUserId,
            role: "owner",
            status: "ACTIVE",
          },
          {
            workspaceId: STARTER_WORKSPACE_ID,
            draftNamespace: WIZARD_NAMESPACE,
            draftKey: DRAFT_KEY,
          },
          patchBody({ form: { data: { title: "No workspace context" } }, meta: {} })
        ),
      WorkspaceDraftWorkspaceTypeRequiredError
    );
  });

  it("A6 workspace draft tombstone path does not default to starter", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../src/workspace-drafts/workspace-drafts.service.ts"),
      "utf8"
    );
    assert.doesNotMatch(source, /getActiveWorkspaceType\(\)\s*\?\?\s*["']starter["']/);
    assert.match(source, /WorkspaceDraftWorkspaceTypeRequiredError/);
  });
});
