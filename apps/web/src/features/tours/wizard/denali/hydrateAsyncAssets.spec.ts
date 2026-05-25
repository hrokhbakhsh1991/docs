import assert from "node:assert/strict";
import test from "node:test";

import {
  hydrateAsyncAssets,
  readTourGalleryAsyncAssets,
  type AsyncAsset,
} from "./hydrateAsyncAssets";

test("hydrateAsyncAssets passes through rows that already include url", () => {
  const photos: AsyncAsset[] = [
    {
      id: "photo-1",
      assetId: "asset-1",
      url: "https://cdn.example.com/a.jpg",
      filename: "a.jpg",
      size: 1024,
      mimeType: "image/jpeg",
      uploadedAt: "2026-05-24T09:00:00.000Z",
    },
  ];

  const hydrated = hydrateAsyncAssets(photos);
  assert.equal(hydrated.length, 1);
  assert.equal(hydrated[0]?.id, "photo-1");
  assert.equal(hydrated[0]?.assetId, "asset-1");
  assert.equal(hydrated[0]?.url, "https://cdn.example.com/a.jpg");
  assert.equal(hydrated[0]?.uploadStatus, "uploaded");
});

test("hydrateAsyncAssets resolves assetId-only references from indexed url rows", () => {
  const photos: AsyncAsset[] = [
    {
      id: "photo-1",
      assetId: "asset-1",
      url: "https://cdn.example.com/a.jpg",
      filename: "a.jpg",
      size: 1024,
      mimeType: "image/jpeg",
      uploadedAt: "2026-05-24T09:00:00.000Z",
    },
    {
      assetId: "asset-1",
      filename: "a.jpg",
    },
  ];

  const hydrated = hydrateAsyncAssets(photos);
  assert.equal(hydrated.length, 1);
  assert.equal(hydrated[0]?.url, "https://cdn.example.com/a.jpg");
});

test("hydrateAsyncAssets resolves id-only references via assetId index", () => {
  const photos: AsyncAsset[] = [
    {
      id: "asset-1",
      url: "https://cdn.example.com/b.jpg",
      filename: "b.jpg",
    },
    {
      id: "asset-1",
    },
  ];

  const hydrated = hydrateAsyncAssets(photos);
  assert.equal(hydrated.length, 1);
  assert.equal(hydrated[0]?.url, "https://cdn.example.com/b.jpg");
});

test("hydrateAsyncAssets drops rows that cannot be resolved", () => {
  const hydrated = hydrateAsyncAssets([{ assetId: "missing-asset" }]);
  assert.deepEqual(hydrated, []);
});

test("readTourGalleryAsyncAssets reads tripDetails.photos wire rows", () => {
  const assets = readTourGalleryAsyncAssets({
    details: {
      tripDetails: {
        photos: [
          { id: "p1", assetId: "a1", url: "https://cdn.example.com/p1.jpg" },
          { assetId: "a2" },
        ],
      },
    },
  });

  assert.equal(assets.length, 2);
  assert.equal(assets[0]?.id, "p1");
  assert.equal(assets[1]?.assetId, "a2");
});
