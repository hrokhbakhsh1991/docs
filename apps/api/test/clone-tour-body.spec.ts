/**
 * Phase 11.12 — buildCloneTourCreateBody unit tests (DEC-P11-010)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import type { TourRecord } from "../src/db/tour-record";
import {
  buildCloneTourCreateBody,
  resolveCanonicalRootsFromData,
} from "../src/tours/build-clone-tour-body";

const GOLDEN_MINIMAL = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/workspaces/denali/test/fixtures/golden/tour-minimal.json"
);

const DENALI_SMOKE_TENANT = "00000000-0000-4000-8000-000000000003";

function assertRootsBijection(body: { roots?: string[]; data?: Record<string, unknown> }): void {
  assert.ok(body.roots && body.roots.length > 0);
  assert.ok(body.data);
  assert.deepEqual(body.roots, Object.keys(body.data));
}

describe("clone-tour-body.spec.ts — Phase 11.12", () => {
  it("API-P11-12-01 buildCloneTourCreateBody appends Copy suffix (server canonical path)", async () => {
    const legacyData = JSON.parse(readFileSync(GOLDEN_MINIMAL, "utf8")) as Record<string, unknown>;
    const source: TourRecord = {
      id: "source-tour",
      tenantId: "00000000-0000-4000-8000-000000000014",
      rowVersion: 1,
      createdAt: new Date(),
      canonical: {
        schemaVersion: 1,
        roots: ["title"],
        data: legacyData,
      } as CanonicalDocument,
    };

    const body = await buildCloneTourCreateBody({
      source,
      tenantId: source.tenantId,
      activeEquipmentIds: [],
    });

    const basicInfo = body.data?.basicInfo as { title: string } | undefined;
    assert.equal(basicInfo?.title, "Test (Copy)");
    assertRootsBijection(body);
  });

  it("API-P11-12-02 buildCloneTourCreateBody forces publishStatus draft", async () => {
    const legacyData = JSON.parse(readFileSync(GOLDEN_MINIMAL, "utf8")) as Record<string, unknown>;
    const basicInfo = legacyData.basicInfo as Record<string, unknown>;
    legacyData.basicInfo = { ...basicInfo, publishStatus: "active" };

    const source: TourRecord = {
      id: "source-tour",
      tenantId: "00000000-0000-4000-8000-000000000014",
      rowVersion: 1,
      createdAt: new Date(),
      canonical: {
        schemaVersion: 1,
        roots: ["title"],
        data: legacyData,
      } as CanonicalDocument,
    };

    const body = await buildCloneTourCreateBody({
      source,
      tenantId: source.tenantId,
    });

    const clonedBasicInfo = body.data?.basicInfo as { publishStatus: string };
    assert.equal(clonedBasicInfo.publishStatus, "draft");
    assertRootsBijection(body);
  });

  it("API-P11-12-05 list-shaped tour with basics keeps roots↔data bijection (ED-CLONE-01)", async () => {
    const listShaped: Record<string, unknown> = {
      title: "North Ridge Trek",
      basics: { destinationId: "dest-1", difficulty: "moderate" },
      photos: [],
      publishStatus: "active",
      startDateTime: "2026-07-01T06:00:00.000Z",
    };

    const source: TourRecord = {
      id: "smoke-0220",
      tenantId: DENALI_SMOKE_TENANT,
      rowVersion: 1,
      createdAt: new Date(),
      canonical: {
        schemaVersion: 1,
        roots: ["basics", "title", "photos", "publishStatus", "startDateTime"],
        data: listShaped,
      } as CanonicalDocument,
    };

    const body = await buildCloneTourCreateBody({
      source,
      tenantId: source.tenantId,
    });

    assert.ok(body.data && "basics" in body.data, "legacy basics key retained on clone data");
    assert.ok(body.roots?.includes("basics"));
    assert.equal((body.data as { title: string }).title, "North Ridge Trek (Copy)");
    assert.equal((body.data as { publishStatus: string }).publishStatus, "draft");
    assertRootsBijection(body);
    // Regression: wizard step roots must not appear without matching data keys
    assert.equal(body.roots?.includes("denali_basic"), false);
  });

  it("API-P11-12-05b resolveCanonicalRootsFromData rejects empty data", () => {
    assert.throws(
      () => resolveCanonicalRootsFromData({}),
      /CANONICAL_EMPTY_DATA/
    );
  });
});
