import assert from "node:assert/strict";
import test from "node:test";

import {
  pickDenaliCanonicalGalleryPhoto,
  pickDenaliCanonicalItineraryDayPhoto,
} from "./denaliCanonicalPhotoPick";

test("pickDenaliCanonicalGalleryPhoto omits UI-only upload fields", () => {
  const picked = pickDenaliCanonicalGalleryPhoto({
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    url: "https://cdn.example.com/photo.jpg",
    filename: "photo.jpg",
    size: 1024,
    mimeType: "image/jpeg",
    uploadedAt: "2026-06-01T12:00:00.000Z",
    assetId: "asset-123",
    uploadStatus: "uploaded",
  });

  assert.ok(picked);
  assert.equal("assetId" in picked, false);
  assert.equal("uploadStatus" in picked, false);
  assert.deepEqual(Object.keys(picked).sort(), [
    "filename",
    "id",
    "mimeType",
    "size",
    "uploadedAt",
    "url",
  ]);
});

test("pickDenaliCanonicalItineraryDayPhoto omits UI-only upload fields", () => {
  const picked = pickDenaliCanonicalItineraryDayPhoto({
    id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    url: "https://cdn.example.com/day.jpg",
    assetId: "asset-456",
    uploadStatus: "pending",
  });

  assert.ok(picked);
  assert.deepEqual(picked, {
    id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    url: "https://cdn.example.com/day.jpg",
  });
});
