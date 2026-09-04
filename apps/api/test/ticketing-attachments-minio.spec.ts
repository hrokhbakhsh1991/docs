/**
 * Ticketing attachment object keys — MinIO round-trip (skipped when MINIO_* unset).
 * @see docs/standards/ticketing-system.mdoc §19.4
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { ensureMinioPhotoBucket, pingMinioPhotoStorage } from "@app-tour/workspace-denali";

import { readTenantBrandLogoMinioConfigFromEnv } from "../src/tenant/workspace-branding-photo-storage";
import {
  buildTicketAttachmentObjectKey,
  getTicketAttachmentSignedReadUrl,
  putTicketAttachmentObject,
  removeTicketAttachmentObject,
} from "../src/workspace-ticketing/ticket-attachment-storage";
import {
  isMinioEnvironmentFailure,
  minioEnvironmentSkipReason,
} from "./lib/minio-environment-skip";

const minioConfig = readTenantBrandLogoMinioConfigFromEnv();
const minioSkip = minioConfig === null ? "MINIO_* env not set" : false;

const tenantId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ticketId = randomUUID();
const messageId = randomUUID();
const attachmentId = randomUUID();

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

describe("ticketing-attachments-minio.spec.ts", () => {
  it("buildTicketAttachmentObjectKey uses tickets/{tenantId}/… prefix", () => {
    const key = buildTicketAttachmentObjectKey({
      tenantId,
      ticketId,
      messageId,
      attachmentId,
    });
    assert.equal(key, `tickets/${tenantId}/${ticketId}/${messageId}/${attachmentId}`);
  });

  it("PUT + signed GET round-trip when MinIO is available", { skip: minioSkip }, async (t) => {
    assert.ok(minioConfig);
    const storageKey = buildTicketAttachmentObjectKey({
      tenantId,
      ticketId,
      messageId,
      attachmentId,
    });
    try {
      await ensureMinioPhotoBucket(minioConfig);
      assert.ok(
        await pingMinioPhotoStorage(minioConfig),
        "MinIO bucket must exist after ensureMinioPhotoBucket",
      );

      await putTicketAttachmentObject({
        tenantId,
        storageKey,
        body: PNG_HEADER,
        contentType: "image/png",
      });

      const signedUrl = await getTicketAttachmentSignedReadUrl({
        tenantId,
        storageKey,
      });
      assert.match(signedUrl, /^https?:\/\//);

      const res = await fetch(signedUrl);
      assert.equal(res.status, 200);

      await removeTicketAttachmentObject({ tenantId, storageKey });
    } catch (error) {
      if (isMinioEnvironmentFailure(error)) {
        t.skip(minioEnvironmentSkipReason(error));
        return;
      }
      throw error;
    }
  });
});
