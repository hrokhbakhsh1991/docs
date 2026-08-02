import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  assertDenaliTourPhotoKeyTenantScope,
  buildDenaliTourPhotoObjectKey,
  buildDenaliWizardDraftPhotoObjectKey,
  getDenaliTourPhotoSignedReadUrl,
  ensureMinioPhotoBucket,
  pingMinioPhotoStorage,
  putDenaliTourPhoto,
  readMinioPhotoConfigFromEnv,
} from "@app-tour/workspace-denali";

import {
  isMinioEnvironmentFailure,
  minioEnvironmentSkipReason,
} from "./lib/minio-environment-skip";

const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const tourId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const photoId = randomUUID();

const minioConfig = readMinioPhotoConfigFromEnv();
const minioSkip = minioConfig === null ? "MINIO_* env not set" : false;

describe("minio-photo.spec.ts (REQ-P6-016, RULE-P6-009)", () => {
  it("buildDenaliTourPhotoObjectKey uses tenant/tour/photos prefix", () => {
    const key = buildDenaliTourPhotoObjectKey({ tenantId: tenantA, tourId, photoId });
    assert.equal(key, `${tenantA}/tours/${tourId}/photos/${photoId}`);
  });

  it("buildDenaliWizardDraftPhotoObjectKey uses tenant/wizard-drafts prefix", () => {
    const sessionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const key = buildDenaliWizardDraftPhotoObjectKey({
      tenantId: tenantA,
      sessionId,
      photoId,
    });
    assert.equal(key, `${tenantA}/wizard-drafts/${sessionId}/photos/${photoId}`);
  });

  it("assertDenaliTourPhotoKeyTenantScope throws for cross-tenant key", () => {
    const key = buildDenaliTourPhotoObjectKey({ tenantId: tenantA, tourId, photoId });
    assert.throws(
      () => assertDenaliTourPhotoKeyTenantScope(key, tenantB),
      /DENALI_PHOTO_TENANT_MISMATCH/
    );
  });

  it(
    "REQ-P6-016: PUT + signed GET round-trip when MinIO is available",
    { skip: minioSkip },
    async (t) => {
      assert.ok(minioConfig);
      try {
        await ensureMinioPhotoBucket(minioConfig);
        assert.ok(
          await pingMinioPhotoStorage(minioConfig),
          "MinIO bucket must exist after ensureMinioPhotoBucket"
        );

        const payload = Buffer.from("denali-photo-smoke-bytes", "utf8");
        const { key } = await putDenaliTourPhoto({
          config: minioConfig,
          tenantId: tenantA,
          tourId,
          photoId,
          body: payload,
          contentType: "image/jpeg",
        });

        const signedUrl = await getDenaliTourPhotoSignedReadUrl({
          config: minioConfig,
          tenantId: tenantA,
          key,
        });
        assert.match(signedUrl, /^https?:\/\//);

        const res = await fetch(signedUrl);
        assert.equal(res.status, 200);
        const bytes = Buffer.from(await res.arrayBuffer());
        assert.equal(bytes.toString("utf8"), payload.toString("utf8"));
      } catch (error) {
        if (isMinioEnvironmentFailure(error)) {
          t.skip(minioEnvironmentSkipReason(error));
          return;
        }
        throw error;
      }
    }
  );

  it(
    "RULE-P6-009: tenant B cannot read tenant A object via scoped signed URL helper",
    { skip: minioSkip },
    async () => {
      assert.ok(minioConfig);
      const key = buildDenaliTourPhotoObjectKey({ tenantId: tenantA, tourId, photoId });
      await assert.rejects(
        () =>
          getDenaliTourPhotoSignedReadUrl({
            config: minioConfig,
            tenantId: tenantB,
            key,
          }),
        /DENALI_PHOTO_TENANT_MISMATCH/
      );
    }
  );
});
