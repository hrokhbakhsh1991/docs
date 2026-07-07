/**
 * Phase 9.3 — Denali tour list projection (REQ-P9-032 · DEC-P9-014).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTourListProjection,
  createCanonicalDocument,
} from "@app-tour/workspace-sdk";

import { extractDenaliTourListProjection } from "../src/list/tour-list-projection";
import { getDenaliWorkspacePlugin } from "../src/denali.plugin";

function buildDenaliCanonicalData(
  roots: readonly string[],
  patch: Record<string, unknown>
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const root of roots) {
    if (
      root.startsWith("denali_") ||
      root === "review" ||
      root === "program" ||
      root === "transport" ||
      root === "pricing" ||
      root === "participants" ||
      root === "policies" ||
      root === "tripDetails" ||
      root === "photos" ||
      root === "gatheringPoints"
    ) {
      data[root] = {};
      continue;
    }
    data[root] = null;
  }
  return { ...data, ...patch };
}

describe("tour-list-projection.spec.ts — workspace-denali", () => {
  it("DN-9.3-01 extractTourListProjection matches TOURS-LIST-PROJECTION schema", () => {
    const plugin = getDenaliWorkspacePlugin();
    const canonical = createCanonicalDocument({
      schemaVersion: 1,
      roots: [...plugin.wizard.roots],
      data: buildDenaliCanonicalData(plugin.wizard.roots, {
        title: "صعود به قله دماوند - جبهه جنوبی",
        publishStatus: "draft",
        startDateTime: "2026-06-01T08:00:00.000Z",
        capacityMax: 15,
        category: "mountain_day",
        program: { shortDescription: "یک برنامه جذاب برای صعود به بام ایران." },
        pricing: { basePricePerPerson: 500_000, requiresPayment: true },
      }),
    });

    const projection = buildTourListProjection(
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        tenantId: "00000000-0000-4000-8000-000000000001",
        createdAt: "2026-06-01T08:00:00.000Z",
        updatedAt: "2026-06-02T10:00:00.000Z",
        rowVersion: 3,
      },
      canonical,
      extractDenaliTourListProjection
    );

    assert.equal(projection.title, "صعود به قله دماوند - جبهه جنوبی");
    assert.equal(projection.shortDescription, "یک برنامه جذاب برای صعود به بام ایران.");
    assert.equal(projection.listStatus, "draft");
    assert.equal(projection.uiStatus, "draft");
    assert.equal(projection.priceAmount, 500_000);
    assert.equal(projection.priceCurrency, "IRR");
    assert.equal(projection.totalCapacity, 15);
    assert.equal(projection.acceptedCount, 0);
    assert.equal(projection.category, "mountain_day");
    assert.equal(projection.coverImageUrl, null);
    assert.equal(projection.coverImageStorageKey, null);
    assert.equal(projection.departureAt, "2026-06-01T08:00:00.000Z");
    assert.equal(
      plugin.tourList?.extractTourListProjection(canonical).title,
      projection.title
    );
  });

  it("DN-9.3-02 coverImageUrl uses https url on first photo", () => {
    const plugin = getDenaliWorkspacePlugin();
    const canonical = createCanonicalDocument({
      schemaVersion: 1,
      roots: [...plugin.wizard.roots],
      data: buildDenaliCanonicalData(plugin.wizard.roots, {
        title: "Cover tour",
        publishStatus: "active",
        photos: [{ id: "p1", url: "https://cdn.example.com/cover.jpg" }],
      }),
    });

    const fields = extractDenaliTourListProjection(canonical);
    assert.equal(fields.coverImageUrl, "https://cdn.example.com/cover.jpg");
    assert.equal(fields.coverImageStorageKey, null);
  });

  it("DN-9.3-03 coverImageStorageKey uses first photo MinIO key", () => {
    const plugin = getDenaliWorkspacePlugin();
    const canonical = createCanonicalDocument({
      schemaVersion: 1,
      roots: [...plugin.wizard.roots],
      data: buildDenaliCanonicalData(plugin.wizard.roots, {
        title: "MinIO cover tour",
        publishStatus: "draft",
        photos: [
          {
            id: "p1",
            storageKey: "tenant/wizard-drafts/session/photos/p1",
          },
        ],
      }),
    });

    const fields = extractDenaliTourListProjection(canonical);
    assert.equal(fields.coverImageUrl, null);
    assert.equal(fields.coverImageStorageKey, "tenant/wizard-drafts/session/photos/p1");
  });

  it("DN-9.3-04 coverImageStorageKey reads legacy photosData.photos", () => {
    const fields = extractDenaliTourListProjection({
      schemaVersion: 1,
      roots: ["title", "publishStatus", "photosData"],
      data: {
        title: "Legacy stored tour",
        publishStatus: "draft",
        photosData: {
          photos: [
            {
              id: "p1",
              storageKey: "tenant/tours/tour-id/photos/p1",
            },
          ],
        },
      },
    });

    assert.equal(fields.coverImageUrl, null);
    assert.equal(fields.coverImageStorageKey, "tenant/tours/tour-id/photos/p1");
  });
});
