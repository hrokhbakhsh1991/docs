/**
 * loadAllTourRecordsViaListPage — bounded chunk assembly.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  loadAllTourRecordsViaListPage,
  TOUR_LIST_PAGE_CHUNK_SIZE,
} from "../src/db/load-all-tour-records-via-list-page";
import type { TourRecord } from "../src/db/tour-record";

function tour(id: string): TourRecord {
  const day = String(Number(id) % 28 || 1).padStart(2, "0");
  return {
    id,
    tenantId: "t1",
    canonical: { schemaVersion: 1, data: {} },
    createdAt: `2026-01-${day}T00:00:00.000Z`,
    rowVersion: 1,
  };
}

describe("load-all-tour-records-via-list-page.spec.ts", () => {
  it("loads all pages until nextCursor is null", async () => {
    const pageSize = TOUR_LIST_PAGE_CHUNK_SIZE;
    const total = pageSize + 5;
    const all = Array.from({ length: total }, (_, index) =>
      tour(String(index + 1).padStart(3, "0"))
    );
    let calls = 0;

    const records = await loadAllTourRecordsViaListPage({
      async listPage(_extra, page) {
        calls += 1;
        const start =
          page.cursor === undefined
            ? 0
            : all.findIndex((row) => row.id === page.cursor) + 1;
        const slice = all.slice(start, start + page.limit);
        const hasMore = start + slice.length < all.length;
        return {
          items: slice,
          nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1]!.id : null,
        };
      },
    });

    assert.equal(records.length, total);
    assert.ok(calls >= 2, "must issue multiple bounded pages when rows exceed chunk size");
  });
});
