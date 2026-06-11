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
import { buildCloneTourCreateBody } from "../src/tours/build-clone-tour-body";

const GOLDEN_MINIMAL = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/workspaces/denali/test/fixtures/golden/tour-minimal.json"
);

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
  });
});
