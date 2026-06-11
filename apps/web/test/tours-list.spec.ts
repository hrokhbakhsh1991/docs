/**
 * Phase 9.3 — tours list UI
 * Authority: docs/phase-9/subphases/9.3-tours-operator.md · REQ-P9-031
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OPERATOR_WIZARD_PATH } from "../src/admin/require-operator-session";
import {
  DEFAULT_TOUR_LIST_QUERY,
  parseTourListQuery,
  serializeTourListQuery,
  TOURS_LIST_TEST_IDS,
} from "../src/features/tours/query-model";
import {
  queryStatusToUiStatus,
  tourListQueryHasFilters,
  tourListTotalPages,
  uiStatusToQueryStatus,
} from "../src/features/tours/tours-list-logic";
import {
  formatTourDeparture,
  formatTourPrice,
  formatTourSeats,
} from "../src/features/tours/tour-list-formatters";
import { formatLocalizedNumber } from "../src/i18n/format-localized-digits";

describe("tours-list.spec.ts — Phase 9.3 Web", () => {
  it("WEB-9.3-01 tour list exposes page landmarks (CP-9.3-L06)", () => {
    assert.equal(TOURS_LIST_TEST_IDS.page, "operator-tours-page");
    assert.equal(TOURS_LIST_TEST_IDS.list, "operator-tours-list");
    assert.equal(TOURS_LIST_TEST_IDS.search, "operator-tours-search");
    assert.equal(TOURS_LIST_TEST_IDS.status, "operator-tours-status");
    assert.equal(TOURS_LIST_TEST_IDS.sort, "operator-tours-sort");
    assert.equal(TOURS_LIST_TEST_IDS.pagination, "operator-tours-pagination");
  });

  it("WEB-9.3-03 URL query model round-trips search and status (CP-9.3-L07)", () => {
    const serialized = serializeTourListQuery({
      ...DEFAULT_TOUR_LIST_QUERY,
      search: "alpine",
      status: "completed",
      page: 2,
      sortBy: "title",
      sortDir: "asc",
    });
    const parsed = parseTourListQuery(new URLSearchParams(serialized));
    assert.equal(parsed.search, "alpine");
    assert.equal(parsed.status, "completed");
    assert.equal(parsed.page, 2);
    assert.equal(parsed.sortBy, "title");
    assert.equal(parsed.sortDir, "asc");
    assert.match(serialized, /view=operator/);
  });

  it("WEB-9.3-03 status select maps draft UI to API active bucket", () => {
    assert.equal(uiStatusToQueryStatus("draft"), "active");
    assert.equal(queryStatusToUiStatus("active"), "draft");
    const serialized = serializeTourListQuery({
      ...DEFAULT_TOUR_LIST_QUERY,
      status: uiStatusToQueryStatus("draft"),
    });
    assert.match(serialized, /status=active/);
  });

  it("WEB-9.3-02 create CTA targets wizard only (DEC-P9-007)", () => {
    assert.equal(OPERATOR_WIZARD_PATH, "/tours/new");
    assert.doesNotMatch(OPERATOR_WIZARD_PATH, /\(app\)/);
  });

  it("WEB-9.3-04 duplicate action uses clone query on wizard path (CP-9.3-L09)", () => {
    const tourId = "00000000-0000-4000-8000-000000000099";
    const cloneUrl = `${OPERATOR_WIZARD_PATH}?clone=${encodeURIComponent(tourId)}`;
    assert.equal(cloneUrl, `/tours/new?clone=${tourId}`);
    assert.equal(TOURS_LIST_TEST_IDS.duplicate, "operator-tours-duplicate");
  });

  it("WEB-9.3-06 category query serializes for Denali list filter", () => {
    const serialized = serializeTourListQuery({
      ...DEFAULT_TOUR_LIST_QUERY,
      category: "mountain_day",
    });
    assert.match(serialized, /category=mountain_day/);
    const parsed = parseTourListQuery(new URLSearchParams(serialized));
    assert.equal(parsed.category, "mountain_day");
    assert.equal(
      tourListQueryHasFilters({ ...DEFAULT_TOUR_LIST_QUERY, category: "mountain_day" }),
      true
    );
  });

  it("WEB-9.3-05 empty catalog vs filter semantics (CP-9.3-L08)", () => {
    assert.equal(tourListQueryHasFilters(DEFAULT_TOUR_LIST_QUERY), false);
    assert.equal(
      tourListQueryHasFilters({ ...DEFAULT_TOUR_LIST_QUERY, search: "desert" }),
      true
    );
    assert.equal(TOURS_LIST_TEST_IDS.emptyCatalog, "operator-tours-empty-catalog");
    assert.equal(TOURS_LIST_TEST_IDS.empty, "operator-tours-empty");
  });

  it("tour list formatters produce stable card meta labels", () => {
    assert.equal(formatTourPrice(1200, "USD", "en"), "$1,200");
    assert.equal(formatTourDeparture("2026-07-15T12:00:00.000Z", "en")?.includes("2026"), true);
    assert.equal(formatTourSeats({ acceptedCount: 3, totalCapacity: 12 }), "3/12 seats");
  });

  it("WEB-W5-FMT-01 fa locale formatters use Persian copy", async () => {
    const { loadAppMessages } = await import("../src/i18n/load-messages");
    const messages = await loadAppMessages("fa");
    const format = messages.tours.format as {
      seatsWithCapacity: string;
      seatsOpen: string;
    };
    const seatsLabel = formatTourSeats(
      { acceptedCount: 3, totalCapacity: 12 },
      {
        withCapacity: (accepted, capacity) =>
          format.seatsWithCapacity
            .replace("{accepted, number}", formatLocalizedNumber(accepted, "fa"))
            .replace("{capacity, number}", formatLocalizedNumber(capacity, "fa")),
        open: (accepted) =>
          format.seatsOpen.replace("{accepted, number}", formatLocalizedNumber(accepted, "fa")),
      }
    );
    assert.equal(seatsLabel, `${formatLocalizedNumber(3, "fa")}/${formatLocalizedNumber(12, "fa")} نفر`);
    const faPrice = formatTourPrice(1200, "USD", "fa");
    assert.notEqual(faPrice, "$1,200");
    assert.equal(faPrice?.includes("۲۰۰") ?? faPrice?.includes("200"), true);
  });

  it("pagination total pages helper (CP-9.3-L08)", () => {
    assert.equal(tourListTotalPages(0, 10), 1);
    assert.equal(tourListTotalPages(24, 10), 3);
  });
});
