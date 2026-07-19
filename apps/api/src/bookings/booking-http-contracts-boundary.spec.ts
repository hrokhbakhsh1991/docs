/**
 * Phase B1.2 — Booking HTTP contracts ownership boundary.
 *
 * Proves:
 * - BookingsService has no HTTP imports
 * - contracts have no Prisma / workspace / node:http imports
 * - routes only compose HTTP → service (parsers live in contracts)
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isBookingJsonReceiptContentType,
  parseBookingsListQuery,
  parseBulkApproveBookingsBody,
  parseCreateBookingBody,
  parseRejectBookingBody,
} from "@app-tour/booking-http-contracts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../../");
const contractsSrc = join(repoRoot, "packages/booking-http-contracts/src");

function read(rel: string): string {
  return readFileSync(join(here, rel), "utf8");
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("BK-B1.2 booking-http-contracts boundary", () => {
  it("contracts have no Prisma, workspace, apps/api, or node:http imports", () => {
    for (const file of walkTsFiles(contractsSrc)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /from ["'][^"']*apps\/api/);
      assert.doesNotMatch(src, /@apps\/api/);
      assert.doesNotMatch(src, /@prisma\/client/);
      assert.doesNotMatch(src, /from ["']prisma/);
      assert.doesNotMatch(src, /@app-tour\/workspace-/);
      assert.doesNotMatch(src, /workspace-sdk/);
      assert.doesNotMatch(src, /from ["']node:http["']/);
      assert.doesNotMatch(src, /require\(["'][^"']*apps\/api/);
    }
  });

  it("BookingsService has no HTTP imports (framework-free)", () => {
    const src = read("bookings.service.ts");
    assert.match(src, /@app-tour\/booking-http-contracts/);
    assert.doesNotMatch(src, /node:http/);
    assert.doesNotMatch(src, /IncomingMessage|ServerResponse/);
    assert.doesNotMatch(src, /bookings\.routes/);
    assert.doesNotMatch(src, /sendJson|sendHttpError|requireOperatorSession/);
    assert.doesNotMatch(src, /parseCreateBookingBody/);
    assert.doesNotMatch(src, /parseBookingsListQuery/);
    assert.doesNotMatch(src, /express|fastify|koa/);
  });

  it("routes only compose HTTP → service (no local parsers / no Prisma)", () => {
    const src = read("bookings.routes.ts");
    assert.match(src, /@app-tour\/booking-http-contracts/);
    assert.match(src, /parseBookingsListQuery/);
    assert.match(src, /parseCreateBookingBody/);
    assert.match(src, /isBookingJsonReceiptContentType/);
    assert.match(src, /from ["']\.\/create-bookings-service["']/);
    assert.match(src, /listBookings|createBooking|approveBooking|rejectBooking|waitlistBooking|cancelBooking|bulkApproveBookings/);
    assert.doesNotMatch(src, /const BOOKING_STATUSES/);
    assert.doesNotMatch(src, /function parseListQuery/);
    assert.doesNotMatch(src, /function parseCreateBody/);
    assert.doesNotMatch(src, /function isJsonReceiptContentType/);
    assert.doesNotMatch(src, /@prisma\/client/);
    assert.doesNotMatch(src, /BookingsService/);
    assert.doesNotMatch(src, /prisma-bookings\.repository|in-memory-bookings\.repository/);
  });

  it("parsers preserve prior route semantics", () => {
    const url = new URL(
      "http://127.0.0.1/bookings?view=mine&status=pending&tourId=t1&paymentStatus=paid&q=ali&cursor=c1&limit=10"
    );
    assert.deepEqual(parseBookingsListQuery(url), {
      view: "mine",
      status: "pending",
      tourId: "t1",
      paymentStatus: "paid",
      q: "ali",
      cursor: "c1",
      limit: 10,
    });
    assert.equal(parseCreateBookingBody({ tourId: "t" }), null);
    assert.deepEqual(
      parseCreateBookingBody({
        tourId: "t1",
        tourTitle: "Trip",
        guestLabel: "Guest",
        partySize: 2,
        departureAt: "2026-08-01T00:00:00.000Z",
        guestEmail: "a@b.c",
      }),
      {
        tourId: "t1",
        tourTitle: "Trip",
        guestLabel: "Guest",
        partySize: 2,
        departureAt: "2026-08-01T00:00:00.000Z",
        guestEmail: "a@b.c",
      }
    );
    assert.deepEqual(parseBulkApproveBookingsBody({ ids: ["a", 1, "b"] }), ["a", "b"]);
    assert.deepEqual(parseRejectBookingBody({ reason: " no " }), { reason: "no" });
    assert.deepEqual(parseRejectBookingBody({}), {});
    assert.equal(isBookingJsonReceiptContentType("application/json"), true);
    assert.equal(isBookingJsonReceiptContentType(""), true);
    assert.equal(isBookingJsonReceiptContentType("multipart/form-data"), false);
  });

  it("repositories do not import booking-http-contracts (domain types only)", () => {
    for (const rel of [
      "prisma-bookings.repository.ts",
      "in-memory-bookings.repository.ts",
      "create-bookings-repository.ts",
      "ports/booking-repository.port.ts",
    ]) {
      const src = read(rel);
      assert.doesNotMatch(src, /@app-tour\/booking-http-contracts/);
      assert.doesNotMatch(src, /bookings\.routes/);
      assert.doesNotMatch(src, /node:http/);
    }
  });

  it("no booking-http handler package yet (handlers remain apps/api)", () => {
    assert.throws(
      () => statSync(join(repoRoot, "packages/booking-http/package.json")),
      /ENOENT/
    );
  });
});
