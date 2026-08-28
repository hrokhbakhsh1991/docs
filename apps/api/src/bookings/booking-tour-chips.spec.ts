/**
 * BOOKINGS-OPS-UX §11.10 P4a/P4c — ops tour chip membership + scope.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareBookingTourChips,
  finalizeBookingTourChips,
  finalizeOpsBookingTourChips,
  isOpsBookingTourChip,
} from "./booking-tour-chips.ts";

const here = dirname(fileURLToPath(import.meta.url));

const DRAFTS = [
  {
    tourId: "past",
    tourTitle: "Past Tour",
    pendingCount: 0,
    waitlistedCount: 0,
    totalCount: 9,
    hasUpcomingDeparture: false,
  },
  {
    tourId: "pending-past",
    tourTitle: "Stuck Pending",
    pendingCount: 1,
    waitlistedCount: 0,
    totalCount: 1,
    hasUpcomingDeparture: false,
  },
  {
    tourId: "waitlist-past",
    tourTitle: "Stuck Waitlist",
    pendingCount: 0,
    waitlistedCount: 2,
    totalCount: 2,
    hasUpcomingDeparture: false,
  },
  {
    tourId: "future",
    tourTitle: "Future Tour",
    pendingCount: 0,
    waitlistedCount: 0,
    totalCount: 4,
    hasUpcomingDeparture: true,
  },
  {
    tourId: "hot",
    tourTitle: "Hot Queue",
    pendingCount: 5,
    waitlistedCount: 1,
    totalCount: 8,
    hasUpcomingDeparture: true,
  },
] as const;

describe("booking-tour-chips.spec.ts — P4a/P4c", () => {
  it("API-9.5-P4a keeps pending, waitlisted, and upcoming; drops pure history", () => {
    assert.equal(
      isOpsBookingTourChip({
        pendingCount: 2,
        waitlistedCount: 0,
        hasUpcomingDeparture: false,
      }),
      true
    );
    assert.equal(
      isOpsBookingTourChip({
        pendingCount: 0,
        waitlistedCount: 0,
        hasUpcomingDeparture: true,
      }),
      true
    );
    assert.equal(
      isOpsBookingTourChip({
        pendingCount: 0,
        waitlistedCount: 3,
        hasUpcomingDeparture: false,
      }),
      true
    );
    assert.equal(
      isOpsBookingTourChip({
        pendingCount: 0,
        waitlistedCount: 0,
        hasUpcomingDeparture: false,
      }),
      false
    );

    const chips = finalizeOpsBookingTourChips(DRAFTS);
    assert.deepEqual(
      chips.map((chip) => chip.tourId),
      ["hot", "pending-past", "future", "waitlist-past"]
    );
    assert.ok(!chips.some((chip) => chip.tourId === "past"));
    // Public DTO strips waitlistedCount; pendingCount stays pending-only.
    assert.deepEqual(
      chips.find((chip) => chip.tourId === "waitlist-past"),
      {
        tourId: "waitlist-past",
        tourTitle: "Stuck Waitlist",
        pendingCount: 0,
        totalCount: 2,
      }
    );
  });

  it("API-9.5-P4c scope=all includes pure-history tours", () => {
    const chips = finalizeBookingTourChips(DRAFTS, "all");
    assert.deepEqual(
      chips.map((chip) => chip.tourId),
      ["hot", "pending-past", "past", "future", "waitlist-past"]
    );
  });

  it("API-9.5-P4d collapses duplicate tour ids before returning UI chips", () => {
    const chips = finalizeBookingTourChips(
      [
        {
          tourId: "renamed",
          tourTitle: "Current Title",
          pendingCount: 1,
          waitlistedCount: 0,
          totalCount: 2,
          hasUpcomingDeparture: true,
        },
        {
          tourId: "renamed",
          tourTitle: "Old Snapshot Title",
          pendingCount: 3,
          waitlistedCount: 1,
          totalCount: 5,
          hasUpcomingDeparture: true,
        },
      ],
      "ops"
    );

    assert.deepEqual(chips, [
      {
        tourId: "renamed",
        tourTitle: "Current Title",
        pendingCount: 4,
        totalCount: 7,
      },
    ]);
  });

  it("API-9.5-P4a sort is pending desc then total desc then title", () => {
    assert.ok(
      compareBookingTourChips(
        { tourId: "a", tourTitle: "A", pendingCount: 1, totalCount: 1 },
        { tourId: "b", tourTitle: "B", pendingCount: 2, totalCount: 1 }
      ) > 0
    );
  });

  it("API-9.5-P4a both repositories share finalizeBookingTourChips", () => {
    const mem = readFileSync(join(here, "in-memory-bookings.repository.ts"), "utf8");
    const prisma = readFileSync(join(here, "prisma-bookings.repository.ts"), "utf8");
    assert.match(mem, /finalizeBookingTourChips/);
    assert.match(prisma, /finalizeBookingTourChips/);
    assert.match(mem, /waitlistedCount/);
    assert.match(prisma, /waitlistedByTour|waitlistedMap|waitlistedCount/);
    const memSummary = mem.slice(
      mem.indexOf("async getBookingsSummaryStats"),
      mem.indexOf("async sumApprovedPartySizeByTourIds")
    );
    assert.doesNotMatch(memSummary, /\.sort\(\s*\(a,\s*b\)\s*=>/);
    const prismaSummary = prisma.slice(
      prisma.indexOf("async getBookingsSummaryStats"),
      prisma.indexOf("async sumApprovedPartySizeByTourIds")
    );
    const primaryChipRowsBlock = prismaSummary.slice(
      prismaSummary.indexOf("waitlist, chipRows"),
      prismaSummary.indexOf("const chipTourIds")
    );
    assert.match(primaryChipRowsBlock, /by:\s*\["tourId"\]/);
    assert.doesNotMatch(primaryChipRowsBlock, /by:\s*\["tourId",\s*"tourTitle"\]/);
  });
});
