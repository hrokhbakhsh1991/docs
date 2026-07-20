import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, "../..");

describe("MR-P0-011 guest duplicate uniqueness", () => {
  it("migration defines partial unique indexes for active guests", () => {
    const sql = readFileSync(
        join(
        apiRoot,
        "prisma/migrations/20260720150000_operator_registration_active_guest_uniques/migration.sql"
      ),
      "utf8"
    );
    for (const name of [
      "uq_operator_reg_active_email",
      "uq_operator_reg_active_user",
      "uq_operator_reg_active_label",
      "uq_operator_reg_active_national_id",
    ]) {
      assert.match(sql, new RegExp(name));
    }
    assert.match(sql, /status NOT IN \('cancelled', 'rejected'\)/);
  });

  it("createBooking maps Prisma P2002 to BOOKING_GUEST_DUPLICATE", () => {
    const src = readFileSync(join(here, "prisma-bookings.repository.ts"), "utf8");
    const fn = src.slice(src.indexOf("async createBooking"));
    const body = fn.slice(0, fn.indexOf("\n  async "));
    assert.match(body, /P2002/);
    assert.match(body, /BOOKING_GUEST_DUPLICATE/);
  });

  it("HTTP map and interceptor treat BOOKING_GUEST_DUPLICATE as 409", () => {
    const map = readFileSync(join(here, "booking-http-error-map.ts"), "utf8");
    assert.match(map, /domainError: "BOOKING_GUEST_DUPLICATE"/);
    const interceptor = readFileSync(join(here, "../middleware/error-interceptor.ts"), "utf8");
    assert.match(interceptor, /BOOKING_GUEST_DUPLICATE/);
  });
});
