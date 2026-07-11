/**
 * Denali wizard photo upload — client validation + draft photo parsing
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractDenaliPhotoApiErrorCode,
  parseDenaliPhotoApiErrorCode,
} from "@app-tour/workspace-denali/host/ui/adapters/photo-upload-errors";
import {
  DENALI_PHOTO_ALLOWED_CONTENT_TYPES,
  resolveDenaliWizardPhotoPreviewUrl,
  validateDenaliPhotoFile,
} from "@app-tour/workspace-denali/host/ui/adapters/photo-upload-client";
import { parseDenaliTourPhotos } from "@app-tour/workspace-denali/host/ui/logic/denali-photo-types";

describe("denali-photo-upload.spec.ts", () => {
  it("WEB-6.7-PHOTO-01 parses storageKey on draft photos", () => {
    const photos = parseDenaliTourPhotos([
      {
        id: "11111111-1111-4111-8111-111111111111",
        label: "Summit",
        storageKey: "tenant/wizard-drafts/session/photos/id",
        contentType: "image/jpeg",
      },
    ]);
    assert.equal(photos.length, 1);
    assert.equal(photos[0]?.storageKey, "tenant/wizard-drafts/session/photos/id");
    assert.equal(photos[0]?.contentType, "image/jpeg");
  });

  it("WEB-6.7-PHOTO-02 validates allowed image types and size", () => {
    for (const type of DENALI_PHOTO_ALLOWED_CONTENT_TYPES) {
      assert.equal(
        validateDenaliPhotoFile({ type, size: 1024 } as File),
        null
      );
    }
    assert.equal(
      validateDenaliPhotoFile({ type: "application/pdf", size: 1024 } as File),
      "PHOTO_INVALID_TYPE"
    );
    assert.equal(
      validateDenaliPhotoFile({ type: "image/jpeg", size: 6 * 1024 * 1024 } as File),
      "PHOTO_FILE_TOO_LARGE"
    );
  });

  it("WEB-6.7-PHOTO-03 parses flat API error codes", () => {
    assert.equal(
      parseDenaliPhotoApiErrorCode({ code: "PHOTO_STORAGE_FULL" }, 507),
      "PHOTO_STORAGE_FULL"
    );
    assert.equal(
      extractDenaliPhotoApiErrorCode({ code: "MINIO_NOT_CONFIGURED" }),
      "PHOTO_STORAGE_NOT_CONFIGURED"
    );
  });

  it("WEB-6.7-PHOTO-04 parses nested BFF error envelopes", () => {
    assert.equal(
      parseDenaliPhotoApiErrorCode(
        { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
        401
      ),
      "PHOTO_AUTH_REQUIRED"
    );
  });

  it("WEB-6.7-PHOTO-05 falls back to HTTP status code", () => {
    assert.equal(parseDenaliPhotoApiErrorCode({}, 500), "PHOTO_UPLOAD_HTTP_500");
  });

  it("WEB-6.7-PHOTO-06 maps tenant DB budget exhaustion to PHOTO_SERVICE_BUSY", () => {
    assert.equal(
      parseDenaliPhotoApiErrorCode({ code: "TENANT_DB_BUDGET_EXCEEDED" }, 503),
      "PHOTO_SERVICE_BUSY"
    );
    assert.equal(
      parseDenaliPhotoApiErrorCode({ code: "DB_POOL_SATURATED" }, 503),
      "PHOTO_SERVICE_BUSY"
    );
  });

  it("WEB-6.7-PHOTO-07 preview URL fetch retries once on 503", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(
          JSON.stringify({ code: "TENANT_DB_BUDGET_EXCEEDED" }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ url: "https://cdn.example/photo.jpg" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof globalThis.fetch;

    try {
      const result = await resolveDenaliWizardPhotoPreviewUrl("tenant/wizard-drafts/session/photos/id");
      assert.equal(calls, 2);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.url, "https://cdn.example/photo.jpg");
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
