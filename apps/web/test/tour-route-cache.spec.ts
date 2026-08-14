import assert from "node:assert/strict";
import { describe, it, beforeEach, mock } from "node:test";

import type { OperatorTourDetailResponse } from "../src/features/tours/operator-tour-detail-types";
import {
  clearTourRouteCacheForTests,
  fetchTourDetailCached,
  readCachedTourDetail,
  readCachedTourPlugin,
  writeCachedTourDetail,
  writeCachedTourPlugin,
} from "../src/features/tours/tour-route-cache";

const TOUR_ID = "tour-cache-test";
const DETAIL = {
  projection: { title: "Cached tour" },
} as OperatorTourDetailResponse;

describe("tour-route-cache", () => {
  beforeEach(() => {
    clearTourRouteCacheForTests();
  });

  it("returns cached tour detail without refetching", async () => {
    writeCachedTourDetail(TOUR_ID, DETAIL);
    const fetchMock = mock.fn(async () => {
      throw new Error("should not fetch");
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const payload = await fetchTourDetailCached(TOUR_ID);
    assert.equal(payload.projection.title, "Cached tour");
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it("dedupes in-flight tour detail requests", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchMock = mock.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const first = fetchTourDetailCached(TOUR_ID);
    const second = fetchTourDetailCached(TOUR_ID);
    assert.equal(fetchMock.mock.callCount(), 1);

    resolveFetch?.({
      ok: true,
      json: async () => DETAIL,
    } as Response);

    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.projection.title, "Cached tour");
    assert.equal(b.projection.title, "Cached tour");
    assert.equal(readCachedTourDetail(TOUR_ID)?.projection.title, "Cached tour");
  });

  it("force option bypasses stale cache", async () => {
    writeCachedTourDetail(TOUR_ID, DETAIL);
    const updated = {
      projection: { title: "Fresh tour" },
    } as OperatorTourDetailResponse;
    const fetchMock = mock.fn(async () => ({
      ok: true,
      json: async () => updated,
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    const payload = await fetchTourDetailCached(TOUR_ID, { force: true });
    assert.equal(payload.projection.title, "Fresh tour");
    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it("stores warmed wizard plugin for flat-edit re-entry", () => {
    writeCachedTourPlugin("denali", { id: "denali" } as never);
    assert.equal(readCachedTourPlugin("denali")?.id, "denali");
  });
});
