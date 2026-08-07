/**
 * Shared finance registration fetch cache (TTL + LRU).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clearFinanceRegistrationCache,
  readFinanceRegistrationCache,
  writeFinanceRegistrationCache,
} from "../src/finance/finance-registration-fetch-cache";
import {
  bookingPaymentBadgeVariant,
  bookingStatusBadgeVariant,
} from "../src/features/bookings/bookings-badge-variants";

describe("finance-registration-fetch-cache", () => {
  it("reads back writes and evicts by max entries", () => {
    clearFinanceRegistrationCache("test-ns");
    writeFinanceRegistrationCache("test-ns", "a".repeat(32), { n: 1 });
    assert.deepEqual(readFinanceRegistrationCache("test-ns", "a".repeat(32)), { n: 1 });

    for (let i = 0; i < 45; i += 1) {
      writeFinanceRegistrationCache("test-ns", `${String(i).padStart(32, "0")}`, i);
    }
    assert.equal(readFinanceRegistrationCache("test-ns", "a".repeat(32)), null);
    clearFinanceRegistrationCache("test-ns");
  });
});

describe("bookings-badge-variants", () => {
  it("maps lifecycle and payment tones", () => {
    assert.equal(bookingStatusBadgeVariant("approved"), "success");
    assert.equal(bookingStatusBadgeVariant("pending"), "warning");
    assert.equal(bookingStatusBadgeVariant("rejected"), "destructive");
    assert.equal(bookingPaymentBadgeVariant("paid"), "success");
    assert.equal(bookingPaymentBadgeVariant("unpaid"), "outline");
  });
});

describe("bookings split-pane scroll contract (UX-BKG-40)", () => {
  it("uses scroll:false on URL replace and no nested lg max-h scrollers", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const src = readFileSync(
      join(process.cwd(), "app/(app)/bookings/bookings-page-client.tsx"),
      "utf8"
    );
    assert.match(src, /scroll:\s*false/);
    assert.doesNotMatch(src, /lg:max-h-\[calc\(100vh-8rem\)\]/);
    assert.match(src, /data-operator-bookings-split/);
  });
});

describe("bookings inbox row geometry (UX-BKG-41 / UX-BKG-55)", () => {
  it("board layout stacks full-width tour groups (no multi-col row squeeze)", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const src = readFileSync(
      join(process.cwd(), "app/(app)/bookings/bookings-page-client.tsx"),
      "utf8"
    );
    assert.match(src, /data-operator-inbox-group="tour"/);
    assert.doesNotMatch(src, /md:grid-cols-2/);
    const rowSrc = readFileSync(
      join(process.cwd(), "src/features/bookings/booking-inbox-row.tsx"),
      "utf8"
    );
    assert.match(rowSrc, /w-full min-w-0/);
    assert.match(rowSrc, /data-queue-row="dense"/);
    assert.match(rowSrc, /border-b/);
    assert.doesNotMatch(rowSrc, /rounded-lg border/);
    assert.doesNotMatch(rowSrc, /BookingCapacityBar/);
    assert.match(src, /data-queue-list="dense"/);
  });
});

describe("bookings sticky inspection (UX-BKG-42)", () => {
  it("locks the whole split to the viewport so inspection cannot leave the screen", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const src = readFileSync(
      join(process.cwd(), "app/(app)/bookings/bookings-page-client.tsx"),
      "utf8"
    );
    assert.match(src, /data-operator-bookings-split/);
    assert.match(src, /lg:sticky lg:top-0/);
    assert.match(src, /lg:h-\[calc\(100dvh-7\.5rem\)\]/);
    assert.match(src, /data-operator-bookings-inspection/);
    assert.match(src, /data-operator-bookings-inspection-body/);
    assert.match(src, /lg:overflow-y-auto/);
  });
});
