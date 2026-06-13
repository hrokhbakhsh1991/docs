/**
 * Phase 11.13 — clone photo remint API (DEC-P11-011)
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const TENANT_ID = "00000000-0000-4000-8000-000000000014";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";

installMemoryStorageDriverForDescribe();

describe("clone-photo-remint.spec.ts — Phase 11.13 API", () => {
  const client = installHttpTestClient(() =>
    createRequestListener({ toursService: createTestToursService() })
  );

  before(() => {
    seedOperatorIdentityFixture();
  });

  it("API-P11-13-01 rejects destination keys outside wizard-drafts", async () => {
    const response = await client.requestJson<{ code?: string }>(
      "POST",
      "/tours/clone-photo-remint",
      {
        headers: operatorAuthHeaders(),
        body: {
          plan: [
            {
              sourceStorageKey: `${TENANT_ID}/tours/tour-a/photos/old-id`,
              destStorageKey: `${TENANT_ID}/tours/tour-b/photos/new-id`,
              oldPhotoId: "old-id",
              newPhotoId: "new-id",
            },
          ],
        },
      }
    );
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "DENALI_PHOTO_REMINT_DEST_FORBIDDEN");
  });

  it("API-P11-13-02 returns 503 when MinIO is not configured", async () => {
    const minioSnapshot = {
      MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
      MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
      MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
      MINIO_BUCKET: process.env.MINIO_BUCKET,
      MINIO_USE_SSL: process.env.MINIO_USE_SSL,
    };
    delete process.env.MINIO_ENDPOINT;
    delete process.env.MINIO_ACCESS_KEY;
    delete process.env.MINIO_SECRET_KEY;
    delete process.env.MINIO_BUCKET;
    delete process.env.MINIO_USE_SSL;
    try {
      const response = await client.requestJson<{ code?: string }>(
        "POST",
        "/tours/clone-photo-remint",
        {
          headers: operatorAuthHeaders(),
          body: {
            plan: [
              {
                sourceStorageKey: `${TENANT_ID}/tours/tour-a/photos/old-id`,
                destStorageKey: `${TENANT_ID}/wizard-drafts/${SESSION_ID}/photos/new-id`,
                oldPhotoId: "old-id",
                newPhotoId: "new-id",
              },
            ],
          },
        }
      );
      assert.equal(response.status, 503);
      assert.equal(response.body.code, "MINIO_NOT_CONFIGURED");
    } finally {
      for (const [key, value] of Object.entries(minioSnapshot)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it("API-P11-13-03 empty plan returns 204", async () => {
    const response = await client.requestJson("POST", "/tours/clone-photo-remint", {
      headers: operatorAuthHeaders(),
      body: { plan: [] },
    });
    assert.equal(response.status, 204);
  });
});
