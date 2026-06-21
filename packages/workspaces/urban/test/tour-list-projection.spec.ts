/**
 * Urban tour list projection (P15 — operator list title from data.tour).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { buildTourListProjection, createCanonicalDocument } from "@app-tour/workspace-sdk";

import { extractUrbanTourListProjection } from "../src/list/tour-list-projection";
import { getUrbanWorkspacePlugin } from "../src/urban.plugin";

const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures/golden");

function loadGolden(filename: string) {
  return JSON.parse(readFileSync(join(GOLDEN_DIR, filename), "utf8")) as {
    schemaVersion: number;
    roots: string[];
    data: Record<string, unknown>;
  };
}

describe("tour-list-projection.spec.ts — workspace-urban", () => {
  it("URB-15-01 extractTourListProjection reads urban-tour-minimal golden", () => {
    const plugin = getUrbanWorkspacePlugin();
    const golden = loadGolden("urban-tour-minimal.json");
    const canonical = createCanonicalDocument(golden);

    const projection = buildTourListProjection(
      {
        id: "00000000-0000-4000-8000-000000000501",
        tenantId: "00000000-0000-4000-8000-000000000004",
        createdAt: "2026-06-01T08:00:00.000Z",
        updatedAt: "2026-06-02T10:00:00.000Z",
        rowVersion: 1,
      },
      canonical,
      extractUrbanTourListProjection
    );

    assert.equal(projection.title, "Berlin city highlights");
    assert.equal(projection.shortDescription, "Starter-plus urban golden fixture");
    assert.equal(projection.listStatus, "draft");
    assert.equal(projection.uiStatus, "draft");
    assert.equal(projection.totalCapacity, 120);
    assert.equal(projection.category, "Berlin");
    assert.equal(projection.departureAt, "2026-07-01");
    assert.equal(
      plugin.tourList?.extractTourListProjection(canonical).title,
      projection.title
    );
  });

  it("URB-15-02 published publishStatus maps to published/active", () => {
    const golden = loadGolden("urban-tour-publish-ready.json");
    const canonical = createCanonicalDocument({
      ...golden,
      data: {
        tour: {
          ...(golden.data.tour as Record<string, unknown>),
          publishStatus: "published",
        },
      },
    });

    const fields = extractUrbanTourListProjection(canonical);
    assert.equal(fields.listStatus, "published");
    assert.equal(fields.uiStatus, "active");
    assert.equal(fields.coverImageUrl, "https://cdn.example.com/urban/munich-cover.jpg");
  });
});
