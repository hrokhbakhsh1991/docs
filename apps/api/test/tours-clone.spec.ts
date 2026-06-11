/**
 * Phase 11.12 — server tour clone API HTTP (DEC-P11-010)
 * Authority: docs/phase-11/subphases/11.12-server-tour-clone.md
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const STARTER_TENANT_ID = "00000000-0000-4000-8000-000000000001";

installMemoryStorageDriverForDescribe();

type CloneResponse = {
  readonly id?: string;
  readonly code?: string;
};

function starterAuthHeaders(): Record<string, string> {
  return {
    "x-tenant-id": STARTER_TENANT_ID,
    "x-authenticated-tenant-id": STARTER_TENANT_ID,
    "x-user-id": OPERATOR_SMOKE.ownerUserId,
    "x-actor-role": "owner",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-starter-clone-test",
  };
}

describe("tours-clone.spec.ts — Phase 11.12 API", () => {
  const client = installHttpTestClient(() =>
    createRequestListener({ toursService: createTestToursService() })
  );

  before(() => {
    seedOperatorIdentityFixture();
    const repo = getIdentityRepository();
    repo.seedMembership({
      userId: OPERATOR_SMOKE.ownerUserId,
      tenantId: STARTER_TENANT_ID,
      role: "owner",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-starter-clone-test",
    });
  });

  it("API-P11-12-03 unknown source returns 404", async () => {
    const response = await client.requestJson<CloneResponse>(
      "POST",
      "/tours/00000000-0000-4000-8000-000000009999/clone",
      {
        headers: operatorAuthHeaders(),
        body: {},
      }
    );
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "TOUR_NOT_FOUND");
  });

  it("API-P11-12-04 starter workspace returns TOUR_CLONE_UNSUPPORTED", async () => {
    const created = await client.requestJson<CloneResponse>("POST", "/tours", {
      headers: starterAuthHeaders(),
      body: {
        data: { basics: { title: "Starter source" }, details: { summary: "clone test" } },
      },
    });
    assert.equal(created.status, 201);

    const cloned = await client.requestJson<CloneResponse>(
      "POST",
      `/tours/${created.body.id}/clone`,
      {
        headers: starterAuthHeaders(),
        body: {},
      }
    );
    assert.equal(cloned.status, 422);
    assert.equal(cloned.body.code, "TOUR_CLONE_UNSUPPORTED");
  });
});
