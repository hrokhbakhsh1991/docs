/**
 * CW3-07 — tour list projection dispatch migration parity.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { extractTourListProjectionViaPlugin } from "../src/tours/tour-list-projection-compat";
import {
  extractTourListProjectionForWorkspace,
  resolveTourListProjectionExtractorForWorkspace,
} from "../src/tours/workspace-tour-list-projection-dispatch";
import { WORKSPACE_TOUR_LIST_PROJECTION_BINDINGS } from "../src/tours/workspace-tour-list-projection-bindings.generated";

function denaliCanonical(publishStatus: string): CanonicalDocument {
  return {
    schemaVersion: 1,
    roots: ["title", "publishStatus", "program", "pricing", "capacityMax", "category"],
    data: {
      title: "Denali summit",
      publishStatus,
      program: { shortDescription: "Alpine day" },
      pricing: { basePricePerPerson: 1000 },
      capacityMax: 12,
      category: "mountain_day",
    },
  };
}

function urbanCanonical(publishStatus: string): CanonicalDocument {
  return {
    schemaVersion: 1,
    roots: ["tour"],
    data: {
      tour: {
        title: "Urban walk",
        publishStatus,
        catalogSummary: "City highlights",
        capacity: 80,
        city: "Berlin",
        startDate: "2026-07-01",
      },
    },
  };
}

describe("CW3-07 tour list projection dispatch migration", () => {
  it("CW3-07-01 codegen bindings include denali and urban", () => {
    const workspaceTypes = WORKSPACE_TOUR_LIST_PROJECTION_BINDINGS.map(
      (binding) => binding.workspaceType,
    );
    assert.deepEqual([...workspaceTypes].sort(), ["denali", "urban"]);
  });

  it("CW3-07-02 dispatch parity matches plugin extractor for denali active/draft", async () => {
    const active = denaliCanonical("active");
    const draft = denaliCanonical("draft");
    assert.deepEqual(
      extractTourListProjectionForWorkspace("denali", active),
      await extractTourListProjectionViaPlugin("denali", active),
    );
    assert.deepEqual(
      extractTourListProjectionForWorkspace("denali", draft),
      await extractTourListProjectionViaPlugin("denali", draft),
    );
    assert.equal(extractTourListProjectionForWorkspace("denali", active).listStatus, "open");
    assert.equal(extractTourListProjectionForWorkspace("denali", active).uiStatus, "active");
    assert.equal(extractTourListProjectionForWorkspace("denali", draft).listStatus, "draft");
  });

  it("CW3-07-03 dispatch parity matches plugin extractor for urban published/archived/draft", async () => {
    const published = urbanCanonical("published");
    const archived = urbanCanonical("archived");
    const draft = urbanCanonical("draft");
    assert.deepEqual(
      extractTourListProjectionForWorkspace("urban", published),
      await extractTourListProjectionViaPlugin("urban", published),
    );
    assert.deepEqual(
      extractTourListProjectionForWorkspace("urban", archived),
      await extractTourListProjectionViaPlugin("urban", archived),
    );
    assert.deepEqual(
      extractTourListProjectionForWorkspace("urban", draft),
      await extractTourListProjectionViaPlugin("urban", draft),
    );
    assert.equal(extractTourListProjectionForWorkspace("urban", published).listStatus, "published");
    assert.equal(extractTourListProjectionForWorkspace("urban", archived).listStatus, "archived");
    assert.equal(extractTourListProjectionForWorkspace("urban", draft).listStatus, "draft");
  });

  it("CW3-07-04 resolveTourListProjectionExtractorForWorkspace matches dispatch fields", () => {
    const canonical = denaliCanonical("active");
    const extract = resolveTourListProjectionExtractorForWorkspace("denali");
    assert.deepEqual(extract(canonical), extractTourListProjectionForWorkspace("denali", canonical));
  });

  it("CW3-07-05 starter fail-soft — unknown workspace returns draft projection", () => {
    const canonical = denaliCanonical("active");
    const projection = extractTourListProjectionForWorkspace("starter", canonical);
    assert.equal(projection.listStatus, "draft");
    assert.equal(projection.uiStatus, "draft");
  });
});
