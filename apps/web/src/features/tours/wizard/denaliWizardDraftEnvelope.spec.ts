import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import {
  getDenaliWizardDraftVersionHash,
  parseDenaliWizardDraftRecord,
  serializeDenaliWizardDraft,
} from "./denaliWizardDraftEnvelope";

test("serializeDenaliWizardDraft preserves file upload metadata", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.photosData.photos = [
    {
      id: "file-1",
      url: "https://cdn.example.com/uploads/policy-1.jpg",
      filename: "policy-1.jpg",
      size: 2048,
      mimeType: "image/jpeg",
      uploadedAt: "2026-05-24T09:00:00.000Z",
      uploadStatus: "uploaded",
      assetId: "asset-1",
    },
  ];

  const serialized = serializeDenaliWizardDraft(form, undefined);
  const parsed = parseDenaliWizardDraftRecord(serialized);

  assert.ok(parsed);
  const row = parsed.formPatch.photosData?.photos?.[0];
  assert.ok(row);
  assert.equal(row.url, "https://cdn.example.com/uploads/policy-1.jpg");
  assert.equal(row.uploadStatus, "uploaded");
  assert.equal(row.assetId, "asset-1");
});

test("serializeDenaliWizardDraft embeds versionHash", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.title = "Hash probe";

  const serialized = serializeDenaliWizardDraft(form, undefined);
  const parsed = parseDenaliWizardDraftRecord(serialized);

  assert.ok(parsed);
  assert.equal(parsed.versionHash, getDenaliWizardDraftVersionHash());
});
