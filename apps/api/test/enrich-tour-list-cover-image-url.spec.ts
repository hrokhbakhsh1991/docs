import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import { enrichTourListProjectionCoverImageUrl } from "../src/tours/enrich-tour-list-cover-image-url";

const TENANT_ID = "00000000-0000-4000-8000-000000000003";

function baseProjection() {
  return {
    id: "00000000-0000-4000-8000-000000000210",
    tenantId: TENANT_ID,
    createdAt: "2026-06-01T08:00:00.000Z",
    updatedAt: "2026-06-02T10:00:00.000Z",
    rowVersion: 1,
    title: "Cover tour",
    shortDescription: null,
    listStatus: "draft" as const,
    uiStatus: "draft" as const,
    priceAmount: null,
    priceCurrency: null,
    totalCapacity: null,
    acceptedCount: 0,
    category: null,
    coverImageUrl: null,
    coverImageStorageKey: null,
    departureAt: null,
  };
}

describe("enrich-tour-list-cover-image-url", () => {
  it("API-COVER-01 leaves projection unchanged when cover already set", async () => {
    const projection = { ...baseProjection(), coverImageUrl: "https://cdn.example.com/a.jpg" };
    const canonical = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["photos"],
      data: { photos: [] },
    });
    const enriched = await enrichTourListProjectionCoverImageUrl(
      projection,
      canonical,
      TENANT_ID,
      "denali"
    );
    assert.equal(enriched.coverImageUrl, "https://cdn.example.com/a.jpg");
    assert.equal(enriched.coverImageStorageKey, null);
  });

  it("API-COVER-02 keeps storageKey for client when MinIO is not configured", async () => {
    const storageKey = `${TENANT_ID}/wizard-drafts/session/photos/p1`;
    const projection = { ...baseProjection(), coverImageStorageKey: storageKey };
    const canonical = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["photos"],
      data: {
        photos: [{ id: "p1", storageKey }],
      },
    });
    const previousEndpoint = process.env.MINIO_ENDPOINT;
    delete process.env.MINIO_ENDPOINT;
    try {
      const enriched = await enrichTourListProjectionCoverImageUrl(
        projection,
        canonical,
        TENANT_ID,
        "denali"
      );
      assert.equal(enriched.coverImageUrl, null);
      assert.equal(enriched.coverImageStorageKey, storageKey);
    } finally {
      if (previousEndpoint !== undefined) {
        process.env.MINIO_ENDPOINT = previousEndpoint;
      }
    }
  });
});
