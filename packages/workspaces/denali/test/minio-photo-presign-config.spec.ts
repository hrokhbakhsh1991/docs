import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readMinioPhotoConfigFromEnv,
  resolveMinioPhotoPresignConfig,
} from "../src/photos/minio-photo-storage";

describe("minio-photo-presign-config", () => {
  it("MINIO-PS-01 presign uses MINIO_PUBLIC_ENDPOINT host when set", () => {
    const internal = readMinioPhotoConfigFromEnv({
      MINIO_ENDPOINT: "http://127.0.0.1:9002",
      MINIO_PUBLIC_ENDPOINT: "http://89.42.210.252:9002",
      MINIO_ACCESS_KEY: "minioadmin",
      MINIO_SECRET_KEY: "secret",
      MINIO_BUCKET: "app-tour-staging",
    });
    assert.ok(internal);
    const presign = resolveMinioPhotoPresignConfig(internal, {
      MINIO_PUBLIC_ENDPOINT: "http://89.42.210.252:9002",
    });
    assert.equal(presign.endPoint, "89.42.210.252");
    assert.equal(presign.port, 9002);
    assert.equal(presign.bucket, "app-tour-staging");
  });

  it("MINIO-PS-02 presign falls back to internal endpoint when public unset", () => {
    const internal = readMinioPhotoConfigFromEnv({
      MINIO_ENDPOINT: "http://127.0.0.1:9002",
      MINIO_ACCESS_KEY: "minioadmin",
      MINIO_SECRET_KEY: "secret",
      MINIO_BUCKET: "app-tour-staging",
    });
    assert.ok(internal);
    const presign = resolveMinioPhotoPresignConfig(internal, {});
    assert.equal(presign.endPoint, "127.0.0.1");
    assert.equal(presign.port, 9002);
  });
});
