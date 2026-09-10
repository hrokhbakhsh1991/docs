/**
 * Phase 9.3 — tours list UI
 * Authority: docs/phase-9/subphases/9.3-tours-operator.md · REQ-P9-031
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { OPERATOR_WIZARD_PATH } from "../src/admin/require-operator-session";
import { resolveTourCardActionHierarchy } from "../app/(app)/tours/tour-list-row-actions";
import { ensureTourListCategorySurface } from "../src/features/tours/tour-list-category-registry";
import {
  DEFAULT_TOUR_LIST_QUERY,
  parseTourListQuery,
  serializeTourListQuery,
  TOURS_LIST_TEST_IDS,
} from "../src/features/tours/query-model";
import {
  clearToursListAdvancedFilters,
  queryStatusToUiStatus,
  TOUR_STATUS_UI_OPTIONS,
  tourListQueryHasFilters,
  toursListAdvancedFiltersDirty,
  tourListTotalPages,
  uiStatusToQueryStatus,
} from "../src/features/tours/tours-list-logic";
import {
  resolveTourKindDuration,
  tourCategoryFilterGroupsForPlugin,
} from "../src/features/tours/tour-list-category-logic";
import {
  formatTourDeparture,
  formatTourPrice,
  formatTourSeats,
} from "../src/features/tours/tour-list-formatters";
import { resolveTourPriceDisplayPolicy } from "../src/features/tours/resolve-tour-price-display-policy";
import { formatLocalizedNumber } from "../src/i18n/format-localized-digits";

const PLUGIN_ID = "denali";
const previousAllowDenaliWebPlugin = process.env.ALLOW_DENALI_WEB_PLUGIN;

describe("tours-list.spec.ts — Phase 9.3 Web", () => {
  before(async () => {
    process.env.ALLOW_DENALI_WEB_PLUGIN = "true";
    await ensureTourListCategorySurface(PLUGIN_ID);
  });

  after(() => {
    if (previousAllowDenaliWebPlugin === undefined) {
      delete process.env.ALLOW_DENALI_WEB_PLUGIN;
      return;
    }
    process.env.ALLOW_DENALI_WEB_PLUGIN = previousAllowDenaliWebPlugin;
  });

  it("WEB-9.3-01 tour list exposes page landmarks (CP-9.3-L06)", () => {
    assert.equal(TOURS_LIST_TEST_IDS.page, "operator-tours-page");
    assert.equal(TOURS_LIST_TEST_IDS.controls, "operator-tours-controls");
    assert.equal(TOURS_LIST_TEST_IDS.list, "operator-tours-list");
    assert.equal(TOURS_LIST_TEST_IDS.search, "operator-tours-search");
    assert.equal(TOURS_LIST_TEST_IDS.status, "operator-tours-status");
    assert.equal(TOURS_LIST_TEST_IDS.filtersToggle, "operator-tours-filters-toggle");
    assert.equal(TOURS_LIST_TEST_IDS.filtersPanel, "operator-tours-filters-panel");
    assert.equal(TOURS_LIST_TEST_IDS.activeFilters, "operator-tours-active-filters");
    assert.equal(TOURS_LIST_TEST_IDS.sort, "operator-tours-sort");
    assert.equal(TOURS_LIST_TEST_IDS.sortSelect, "operator-tours-sort-select");
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
    const parsed = parseTourListQuery(PLUGIN_ID, new URLSearchParams(serialized));
    assert.equal(parsed.search, "alpine");
    assert.equal(parsed.status, "completed");
    assert.equal(parsed.page, 2);
    assert.equal(parsed.sortBy, "title");
    assert.equal(parsed.sortDir, "asc");
    assert.match(serialized, /view=operator/);
  });

  it("WEB-TL-ORDER-01 defaults to nearest departure for operator scan", () => {
    assert.equal(DEFAULT_TOUR_LIST_QUERY.sortBy, "departure_at");
    assert.equal(DEFAULT_TOUR_LIST_QUERY.sortDir, "asc");
    const parsed = parseTourListQuery(PLUGIN_ID, new URLSearchParams("view=operator"));
    assert.equal(parsed.sortBy, "departure_at");
    assert.equal(parsed.sortDir, "asc");
    assert.doesNotMatch(serializeTourListQuery(DEFAULT_TOUR_LIST_QUERY), /sort_by=/);
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
    assert.equal(TOURS_LIST_TEST_IDS.duplicateServer, "operator-tours-duplicate-server");
    assert.equal(TOURS_LIST_TEST_IDS.secondaryActions, "operator-tours-secondary-actions");
  });

  it("WEB-TL-ACTIONS-01 uses edit as the primary action for draft tours", () => {
    assert.deepEqual(resolveTourCardActionHierarchy("draft", true), {
      editVariant: "default",
      workspaceVariant: "outline",
    });
  });

  it("WEB-TL-ACTIONS-02 uses manage as the primary action for active tours", () => {
    assert.deepEqual(resolveTourCardActionHierarchy("active", true), {
      editVariant: "outline",
      workspaceVariant: "default",
    });
  });

  it("WEB-TL-ACTIONS-03 keeps edit and workspace routes stable", () => {
    const actions = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/(app)/tours/tour-list-row-actions.tsx"),
      "utf8"
    );
    assert.match(actions, /href=\{`\/tours\/\$\{tour\.id\}\/edit`\}/);
    assert.match(actions, /href=\{`\/tours\/\$\{tour\.id\}\/workspace`\}/);
  });

  it("WEB-TL-ACTIONS-04 action copy removes ambiguous view label", async () => {
    const { loadAppMessages } = await import("../src/i18n/load-messages");
    const messages = await loadAppMessages("fa");
    const card = messages.tours.card as { view: string; workspace: string };
    assert.equal(card.view, "ویرایش تور");
    assert.equal(card.workspace, "مدیریت تور");
    assert.notEqual(card.view, "مشاهده");
  });

  it("WEB-TL-ACTIONS-05 duplicate actions live behind secondary menu", () => {
    const actions = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/(app)/tours/tour-list-row-actions.tsx"),
      "utf8"
    );
    const duplicateActions = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/(app)/tours/tour-duplicate-actions.tsx"),
      "utf8"
    );
    assert.match(actions, /<TourDuplicateActions tourId=\{tour\.id\}/);
    assert.match(duplicateActions, /DropdownMenuTrigger/);
    assert.match(duplicateActions, /TOURS_LIST_TEST_IDS\.secondaryActions/);
    assert.match(duplicateActions, /TOURS_LIST_TEST_IDS\.duplicate/);
    assert.match(duplicateActions, /TOURS_LIST_TEST_IDS\.duplicateServer/);
    assert.doesNotMatch(duplicateActions, /<Button asChild variant="outline" size="sm" data-testid=\{TOURS_LIST_TEST_IDS\.duplicate\}/);
  });

  it("WEB-TL-ACTIONS-06 duplicate copy hides implementation wording", async () => {
    const { loadAppMessages } = await import("../src/i18n/load-messages");
    const messages = await loadAppMessages("fa");
    const card = messages.tours.card as {
      duplicate: string;
      duplicateServer: string;
      moreActions: string;
    };
    assert.equal(card.moreActions, "بیشتر");
    assert.equal(card.duplicate, "ساخت نسخه مشابه");
    assert.equal(card.duplicateServer, "کپی سریع");
    assert.doesNotMatch(card.duplicate, /ویزارد/);
  });

  it("WEB-TL-FINAL-01 directory table leads with title and omits marketing cover", () => {
    const table = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/(app)/tours/tours-directory-table.tsx"),
      "utf8"
    );
    const pageClient = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/(app)/tours/tours-page-client.tsx"),
      "utf8"
    );
    assert.match(table, /tour\.title/);
    assert.match(table, /<TourStatusBadge/);
    assert.doesNotMatch(table, /TourListCoverImage/);
    assert.doesNotMatch(table, /cardCover/);
    assert.doesNotMatch(pageClient, /TourCard/);
    assert.match(pageClient, /ToursDirectoryTable/);
    assert.match(pageClient, /ToursDirectoryMobileRow/);
  });

  it("WEB-TL-FINAL-02 hides disabled archived filter from launch UI", () => {
    assert.deepEqual(TOUR_STATUS_UI_OPTIONS, ["all", "draft", "active"]);
    assert.equal(uiStatusToQueryStatus("archived"), "archived");
    assert.equal(queryStatusToUiStatus("archived"), "archived");
  });

  it("WEB-TL-FINAL-03 tours page copy avoids internal launch wording", async () => {
    const { loadAppMessages } = await import("../src/i18n/load-messages");
    const messages = await loadAppMessages("fa");
    assert.equal(messages.tours.pageSubtitle, "مدیریت و انتشار تورهای باشگاه");
    assert.doesNotMatch(messages.tours.pageSubtitle, /workspace|ویزارد|server|lifecycle/i);
  });

  it("WEB-9.3-06 category query serializes for Denali list filter", () => {
    const serialized = serializeTourListQuery({
      ...DEFAULT_TOUR_LIST_QUERY,
      category: "mountain_day",
    });
    assert.match(serialized, /category=mountain_day/);
    const parsed = parseTourListQuery(PLUGIN_ID, new URLSearchParams(serialized));
    assert.equal(parsed.category, "mountain_day");
    assert.equal(
      tourListQueryHasFilters({ ...DEFAULT_TOUR_LIST_QUERY, category: "mountain_day" }),
      true
    );
  });

  it("WEB-9.3-07 departure_at sort serializes in query model", () => {
    const serialized = serializeTourListQuery({
      ...DEFAULT_TOUR_LIST_QUERY,
      sortBy: "departure_at",
      sortDir: "asc",
    });
    assert.doesNotMatch(serialized, /sort_by=/);
    assert.doesNotMatch(serialized, /sort_dir=/);
    const parsed = parseTourListQuery(PLUGIN_ID, new URLSearchParams(serialized));
    assert.equal(parsed.sortBy, "departure_at");
    assert.equal(parsed.sortDir, "asc");
  });

  it("WEB-9.3-08 created_at sort remains explicit after departure default", () => {
    const serialized = serializeTourListQuery({
      ...DEFAULT_TOUR_LIST_QUERY,
      sortBy: "created_at",
      sortDir: "desc",
    });
    assert.match(serialized, /sort_by=created_at/);
    assert.match(serialized, /sort_dir=desc/);
    const parsed = parseTourListQuery(PLUGIN_ID, new URLSearchParams(serialized));
    assert.equal(parsed.sortBy, "created_at");
    assert.equal(parsed.sortDir, "desc");
    assert.equal(TOURS_LIST_TEST_IDS.cardMeta, "operator-tours-card-meta");
    assert.equal(TOURS_LIST_TEST_IDS.cardDuration, "operator-tours-card-duration");
  });

  it("WEB-9.3-05 empty catalog vs filter semantics (CP-9.3-L08)", () => {
    assert.equal(tourListQueryHasFilters(DEFAULT_TOUR_LIST_QUERY), false);
    assert.equal(tourListQueryHasFilters({ ...DEFAULT_TOUR_LIST_QUERY, search: "desert" }), true);
    assert.equal(TOURS_LIST_TEST_IDS.emptyCatalog, "operator-tours-empty-catalog");
    assert.equal(TOURS_LIST_TEST_IDS.empty, "operator-tours-empty");
  });

  it("tour list formatters produce stable card meta labels", () => {
    assert.equal(formatTourPrice(1200, "USD", "en"), "$1,200");
    assert.equal(formatTourPrice(1200, "", "en"), null);
    assert.equal(formatTourPrice(1200, null, "fa"), null);
    const departure = formatTourDeparture("2026-07-15T12:00:00.000Z", "en");
    assert.ok(departure !== null && departure.includes("2026"));
    assert.equal(formatTourSeats({ acceptedCount: 3, totalCapacity: 12 }), "3/12 seats");
  });

  it("ED-CURR-01 Denali IRR operator price uses toman label without conversion", () => {
    const tomanPolicy = { irrDisplayUnit: "toman" as const };
    assert.equal(formatTourPrice(1200, "IRR", "en", tomanPolicy), "1,200 toman");
    assert.equal(
      formatTourPrice(1200, "IRR", "fa", tomanPolicy),
      `${formatLocalizedNumber(1200, "fa")} تومان`
    );
    assert.equal(formatTourPrice(1200, "IRR", "fa", tomanPolicy)?.includes("ریال") ?? true, false);
    assert.equal(formatTourPrice(1200, "USD", "en", tomanPolicy), "$1,200");
    const harborIrr = formatTourPrice(1200, "IRR", "en");
    assert.equal(harborIrr?.includes("toman") ?? true, false);
  });

  it("CW2-03 Denali IRR operator price reads manifest priceDisplay without plugin cache", () => {
    const denaliPolicy = resolveTourPriceDisplayPolicy("denali");
    assert.deepEqual(denaliPolicy, { irrDisplayUnit: "toman" });
    assert.equal(formatTourPrice(1200, "IRR", "en", denaliPolicy), "1,200 toman");
    assert.equal(resolveTourPriceDisplayPolicy("urban"), null);
    assert.equal(resolveTourPriceDisplayPolicy("starter"), null);
  });

  it("ED-TZ-01 formatTourDeparture uses stable operator display timezone", async () => {
    const { formatDatetimeLocalLabel, isoToDatetimeLocalInput } =
      await import("../src/i18n/datetime-format");
    const iso = "2026-08-15T02:30:00.000Z";
    const expected = formatDatetimeLocalLabel(isoToDatetimeLocalInput(iso), "en");
    assert.equal(formatTourDeparture(iso, "en"), expected);
    assert.equal(isoToDatetimeLocalInput(iso), "2026-08-15T06:00");
  });

  it("WEB-9.3-09 Denali duration chip derives from category slug", () => {
    assert.equal(resolveTourKindDuration(PLUGIN_ID, "mountain_day"), "single_day");
    assert.equal(resolveTourKindDuration(PLUGIN_ID, "mountain_multi"), "multi_day");
    assert.equal(resolveTourKindDuration(PLUGIN_ID, "event_reading"), "single_day");
    assert.equal(resolveTourKindDuration(PLUGIN_ID, "event_cinema_multi"), "multi_day");
    assert.equal(resolveTourKindDuration(PLUGIN_ID, null), null);
  });

  it("WEB-9.3-10 category filter groups match Denali launch surface", () => {
    const slugs = tourCategoryFilterGroupsForPlugin(PLUGIN_ID).flatMap((group) => group.slugs);
    assert.equal(slugs.length, 6);
    assert.ok(slugs.includes("mountain_day"));
    assert.ok(slugs.includes("desert_multi"));
    assert.equal(slugs.some((slug) => slug.startsWith("event_")), false);
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
    assert.equal(
      seatsLabel,
      `${formatLocalizedNumber(3, "fa")}/${formatLocalizedNumber(12, "fa")} نفر`
    );
    const faPrice = formatTourPrice(1200, "USD", "fa");
    assert.notEqual(faPrice, "$1,200");
    assert.equal(faPrice?.includes("۲۰۰") ?? faPrice?.includes("200"), true);
  });

  it("WEB-TL-FILTER-01 advanced filter dirty + clear helpers preserve URL defaults", () => {
    assert.equal(toursListAdvancedFiltersDirty(DEFAULT_TOUR_LIST_QUERY), false);
    assert.equal(
      toursListAdvancedFiltersDirty({ ...DEFAULT_TOUR_LIST_QUERY, status: "active" }),
      true
    );
    const cleared = clearToursListAdvancedFilters({
      ...DEFAULT_TOUR_LIST_QUERY,
      status: "completed",
      category: "mountain_day",
      sortBy: "title",
      sortDir: "asc",
      page: 3,
    });
    assert.equal(cleared.status, "all");
    assert.equal(cleared.category, "all");
    assert.equal(cleared.sortBy, "departure_at");
    assert.equal(cleared.sortDir, "asc");
    assert.equal(cleared.page, 1);
  });

  it("WEB-TL-FILTER-02 compact controls hide status button wall", () => {
    const controls = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/(app)/tours/tours-directory-controls.tsx"),
      "utf8"
    );
    assert.match(controls, /TOUR_STATUS_UI_OPTIONS\.map/);
    assert.match(controls, /<option key=\{option\}/);
    assert.doesNotMatch(controls, /variant=\{statusUi === option \? "default" : "outline"\}/);
    assert.match(controls, /TOURS_LIST_TEST_IDS\.filtersToggle/);
    assert.match(controls, /TOURS_LIST_TEST_IDS\.sortSelect/);
  });

  it("pagination total pages helper (CP-9.3-L08)", () => {
    assert.equal(tourListTotalPages(0, 10), 1);
    assert.equal(tourListTotalPages(24, 10), 3);
  });

  it("WEB-9.3-L15 tours list skeleton mirrors directory table and mobile rows", () => {
    const skeleton = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/(app)/tours/tours-list-skeleton.tsx"),
      "utf8"
    );
    const pageClient = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/(app)/tours/tours-page-client.tsx"),
      "utf8"
    );
    const controls = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/(app)/tours/tours-directory-controls.tsx"),
      "utf8"
    );
    assert.match(skeleton, /OperatorSkeleton size="search"/);
    assert.match(skeleton, /TOURS_LIST_TEST_IDS\.listSkeleton/);
    assert.match(skeleton, /TOURS_LIST_TEST_IDS\.rowSkeleton/);
    assert.match(skeleton, /TOURS_LIST_TEST_IDS\.mobileRowSkeleton/);
    assert.doesNotMatch(skeleton, /aspect-\[16\/9\]/);
    assert.doesNotMatch(skeleton, /OperatorSkeleton size="hero"/);
    assert.match(pageClient, /isInitialLoad/);
    assert.match(pageClient, /isRefetching/);
    assert.match(pageClient, /aria-busy=\{isRefetching/);
    assert.match(pageClient, /ToursDirectoryControls/);
    assert.match(controls, /TOURS_LIST_TEST_IDS\.filtersToggle/);
    assert.match(controls, /TOURS_LIST_TEST_IDS\.activeFilters/);
    assert.match(controls, /Popover/);
    assert.doesNotMatch(pageClient, /\bisDenali\b/);
    assert.match(pageClient, /resolveCatalogListFeatures/);
    assert.match(pageClient, /hasCategoryFilter/);
  });

  it("WEB-TL-ADMIN-01 exposes operator directory table landmarks", () => {
    assert.equal(TOURS_LIST_TEST_IDS.tableDesktop, "operator-tours-table-desktop");
    assert.equal(TOURS_LIST_TEST_IDS.tableMobile, "operator-tours-table-mobile");
    assert.equal(TOURS_LIST_TEST_IDS.row, "operator-tours-row");
    assert.equal(TOURS_LIST_TEST_IDS.rowActions, "operator-tours-row-actions");
    const table = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/(app)/tours/tours-directory-table.tsx"),
      "utf8"
    );
    assert.match(table, /<table/);
    assert.match(table, /data-operator-tours-table/);
    assert.match(table, /hidden overflow-x-auto rounded-xl border bg-card\/40 lg:block/);
  });

  it("WEB-TL-ADMIN-02 mobile rows stay compact without cover imagery", () => {
    const mobile = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/(app)/tours/tours-directory-mobile-row.tsx"),
      "utf8"
    );
    assert.match(mobile, /data-operator-surface="list-row"/);
    assert.doesNotMatch(mobile, /TourListCoverImage/);
    assert.doesNotMatch(mobile, /img/);
  });

  it("WEB-TL-ADMIN-03 pagination chevrons support RTL mirroring", () => {
    const pageClient = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/(app)/tours/tours-page-client.tsx"),
      "utf8"
    );
    assert.match(pageClient, /ChevronLeft className="h-4 w-4 rtl:rotate-180"/);
    assert.match(pageClient, /ChevronRight className="h-4 w-4 rtl:rotate-180"/);
  });

  it("WEB-TL-ADMIN-04 formatTourUpdated uses operator datetime display", async () => {
    const { formatTourUpdated } = await import("../src/features/tours/tour-list-formatters");
    const label = formatTourUpdated("2026-07-15T12:00:00.000Z", "en");
    assert.ok(label.includes("2026"));
  });

  it("WEB-P11-6-05 tours list shows created notice and strips query param", () => {
    const pageClient = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../app/(app)/tours/tours-page-client.tsx"),
      "utf8"
    );
    assert.match(pageClient, /TOURS_LIST_TEST_IDS\.createdNotice/);
    assert.match(pageClient, /searchParams\.get\("created"\)/);
    assert.match(pageClient, /next\.delete\("created"\)/);
  });
});
