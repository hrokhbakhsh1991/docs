/**
 * Tenant brand logo storage — MinIO round-trip (skipped when MINIO_* unset).
 * @see docs/workspaces/tenant-branding.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTenantBrandLogoObjectKey,
  assertTenantBrandLogoKeyTenantScope,
} from "@app-tour/workspace-sdk";
import {
  ensureMinioPhotoBucket,
  pingMinioPhotoStorage,
} from "@app-tour/workspace-denali";

import {
  deleteTenantBrandLogoObject,
  getTenantBrandLogoSignedReadUrl,
  putTenantBrandLogo,
  readTenantBrandLogoMinioConfigFromEnv,
} from "../src/tenant/tenant-branding-storage";
import {
  isMinioEnvironmentFailure,
  minioEnvironmentSkipReason,
} from "./lib/minio-environment-skip";

const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

const minioConfig = readTenantBrandLogoMinioConfigFromEnv();
const minioSkip = minioConfig === null ? "MINIO_* env not set" : false;

describe("tenant-branding-minio.spec.ts", () => {
  it("buildTenantBrandLogoObjectKey uses tenant/branding/logo prefix", () => {
    const key = buildTenantBrandLogoObjectKey(tenantA);
    assert.equal(key, `${tenantA}/branding/logo`);
  });

  it("assertTenantBrandLogoKeyTenantScope throws for cross-tenant key", () => {
    const key = buildTenantBrandLogoObjectKey(tenantA);
    assert.throws(
      () => assertTenantBrandLogoKeyTenantScope(key, tenantB),
      /TENANT_BRAND_LOGO_KEY_FORBIDDEN/
    );
  });

  it(
    "PUT + signed GET round-trip when MinIO is available",
    { skip: minioSkip },
    async (t) => {
      assert.ok(minioConfig);
      try {
        await ensureMinioPhotoBucket(minioConfig);
        assert.ok(
          await pingMinioPhotoStorage(minioConfig),
          "MinIO bucket must exist after ensureMinioPhotoBucket"
        );

        const { storageKey } = await putTenantBrandLogo({
          tenantId: tenantA,
          body: PNG_HEADER,
          contentType: "image/png",
        });
        assert.equal(storageKey, buildTenantBrandLogoObjectKey(tenantA));

        const signedUrl = await getTenantBrandLogoSignedReadUrl({
          tenantId: tenantA,
          storageKey,
        });
        assert.match(signedUrl, /^https?:\/\//);

        const res = await fetch(signedUrl);
        assert.equal(res.status, 200);

        await deleteTenantBrandLogoObject({ tenantId: tenantA, storageKey });
      } catch (error) {
        if (isMinioEnvironmentFailure(error)) {
          t.skip(minioEnvironmentSkipReason(error));
          return;
        }
        throw error;
      }
    }
  );
});
