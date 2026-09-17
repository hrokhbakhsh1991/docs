/**
 * Strict HTTP matrix for tour management mutations.
 * This deliberately tests the dispatcher and auth boundary, not only service functions.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { installHttpTestClient } from "./http-test-client";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type Json = Record<string, unknown>;

function memberHeaders(): Record<string, string> {
  return {
    ...operatorAuthHeaders(),
    "x-user-id": OPERATOR_SMOKE.memberUserId,
    "x-actor-role": "member",
  };
}

function otherTenantHeaders(): Record<string, string> {
  const tenantId = "00000000-0000-4000-8000-000000000099";
  return {
    ...operatorAuthHeaders(),
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-workspace-id": "ws-other-tenant",
  };
}

function createBody(title: string, tenantId?: string): Json {
  return {
    ...(tenantId === undefined ? {} : { tenantId }),
    data: { basics: { title }, details: { summary: `${title} summary` } },
  };
}

describe("tour-management-http-matrix — strict management boundary", () => {
  const client = installHttpTestClient(() =>
    createRequestListener({ toursService: createTestToursService() })
  );

  before(() => {
    seedOperatorIdentityFixture();
    const repo = getIdentityRepository();
    repo.seedUser({ id: OPERATOR_SMOKE.memberUserId, mobile: OPERATOR_SMOKE.memberMobile });
    repo.seedMembership({
      userId: OPERATOR_SMOKE.memberUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-smoke",
    });
  });

  it("POST /tours is idempotent and rejects same-key different payload", async () => {
    const headers = { ...operatorAuthHeaders(), "Idempotency-Key": "tour-matrix-create-1" };
    const first = await client.requestJson<Json>("POST", "/tours", {
      headers,
      body: createBody("matrix-idempotent-source"),
    });
    const replay = await client.requestJson<Json>("POST", "/tours", {
      headers,
      body: createBody("matrix-idempotent-source"),
    });
    assert.equal(first.status, 201);
    assert.equal(replay.status, 201);
    assert.equal(replay.body.id, first.body.id);

    const mismatch = await client.requestJson<Json>("POST", "/tours", {
      headers,
      body: createBody("matrix-idempotent-different"),
    });
    assert.equal(mismatch.status, 409);
    assert.match(String(mismatch.body.code ?? mismatch.body.error), /IDEMPOTENCY|CONFLICT/i);
  });

  it("PATCH /tours enforces row version, member role, and tenant claim", async () => {
    const created = await client.requestJson<Json>("POST", "/tours", {
      headers: operatorAuthHeaders(),
      body: createBody("matrix-patch-source"),
    });
    assert.equal(created.status, 201);
    const tourId = String(created.body.id);

    const member = await client.requestJson<Json>("PATCH", `/tours/${tourId}`, {
      headers: memberHeaders(),
      body: { rowVersion: 1, data: { basics: { title: "member must not write" } } },
    });
    assert.equal(member.status, 403);
    assert.equal(member.body.code, "OPERATOR_TOUR_WRITE_FORBIDDEN");

    const stale = await client.requestJson<Json>("PATCH", `/tours/${tourId}`, {
      headers: operatorAuthHeaders(),
      body: { rowVersion: 999, data: { basics: { title: "stale write" } } },
    });
    assert.equal(stale.status, 400);
    assert.equal(stale.body.code, "VALIDATION_FAILURE");

    const foreignClaim = await client.requestJson<Json>("POST", "/tours", {
      headers: operatorAuthHeaders(),
      body: {
        tenantId: "00000000-0000-4000-8000-000000000099",
        data: { basics: { title: "foreign claim" }, details: { summary: "foreign" } },
      },
    });
    assert.equal(foreignClaim.status, 403);
    assert.match(String(foreignClaim.body.error ?? foreignClaim.body.code), /TENANT|FORBIDDEN/i);
  });

  it("GET/PATCH are tenant-bound and missing tours fail closed", async () => {
    const created = await client.requestJson<Json>("POST", "/tours", {
      headers: operatorAuthHeaders(),
      body: createBody("matrix-tenant-bound"),
    });
    assert.equal(created.status, 201);
    const tourId = String(created.body.id);

    const detail = await client.requestJson<Json>("GET", `/tours/${tourId}`, {
      headers: operatorAuthHeaders(),
    });
    assert.equal(detail.status, 200);
    assert.equal((detail.body.projection as Json).title, "matrix-tenant-bound");

    const foreignRead = await client.requestJson<Json>("GET", `/tours/${tourId}`, {
      headers: otherTenantHeaders(),
    });
    assert.equal(foreignRead.status, 404);
    assert.match(String(foreignRead.body.code ?? foreignRead.body.error), /NOT_FOUND|not_found/i);

    const missing = await client.requestJson<Json>(
      "PATCH",
      "/tours/00000000-0000-4000-8000-000000009999",
      {
        headers: operatorAuthHeaders(),
        body: { rowVersion: 1, data: { basics: { title: "missing" } } },
      }
    );
    assert.equal(missing.status, 404);
  });
});
