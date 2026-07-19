import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * Phase B0.4 — BookingRepositoryPort boundary (Finance FinanceRepositoryPort mirror).
 * No behavior assertions — structural ownership only.
 */

const here = dirname(fileURLToPath(import.meta.url));
const bookingsRoot = join(here);

function read(rel: string): string {
  return readFileSync(join(bookingsRoot, rel), "utf8");
}

describe("booking-repository-port-boundary (B0.4)", () => {
  it("BookingRepositoryPort SoT lives under ports/", () => {
    const port = read("ports/booking-repository.port.ts");
    assert.match(port, /export interface BookingRepositoryPort/);
    assert.match(port, /export type BookingsRepository = BookingRepositoryPort/);
  });

  it("PrismaBookingsRepository implements BookingRepositoryPort", () => {
    const src = read("prisma-bookings.repository.ts");
    assert.match(src, /implements BookingRepositoryPort/);
    assert.match(src, /from ["'].\/ports\/booking-repository\.port["']/);
  });

  it("InMemoryBookingsRepository implements BookingRepositoryPort", () => {
    const src = read("in-memory-bookings.repository.ts");
    assert.match(src, /implements BookingRepositoryPort/);
    assert.doesNotMatch(src, /export type BookingsRepository = \{/);
  });

  it("factory returns BookingRepositoryPort", () => {
    const src = read("create-bookings-repository.ts");
    assert.match(src, /\):\s*BookingRepositoryPort\s*\{/);
    assert.doesNotMatch(src, /export type BookingRepositoryPort\s*=/);
  });
});
